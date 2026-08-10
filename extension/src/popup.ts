import { parserFor } from "./checkout-parser.js";
import {
  QuoteComparison,
  formatMoney,
  providerName,
  type CheckoutSnapshot,
  type PickupQuote,
  type ProviderKind,
} from "./domain.js";

const CAPTURE_KEY = "sidewalk.pickup-quotes";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing extension element: ${selector}`);
  return element;
}

const captureButton = requiredElement<HTMLButtonElement>("#capture");
const clearButton = requiredElement<HTMLButtonElement>("#clear");
const status = requiredElement<HTMLElement>("#status");
const quoteList = requiredElement<HTMLElement>("#quotes");

async function readCheckoutPage(): Promise<CheckoutSnapshot> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) throw new Error("Open a supported checkout first.");

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    func: async () => {
      if (window.location.hostname === "order.online") {
        let otherTip = document.querySelector<HTMLInputElement>(
          '[aria-label="Other tip amount"]',
        );

        if (!otherTip) {
          const otherButton = [...document.querySelectorAll("button")].find(
            (button) => button.textContent?.trim() === "Other",
          );
          if (otherButton instanceof HTMLButtonElement) {
            otherButton.click();
            await new Promise((resolve) => window.setTimeout(resolve, 100));
            otherTip = document.querySelector<HTMLInputElement>(
              '[aria-label="Other tip amount"]',
            );
          }
        }

        if (otherTip && otherTip.value !== "0") {
          const valueSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value",
          )?.set;
          valueSetter?.call(otherTip, "0");
          otherTip.dispatchEvent(new Event("input", { bubbles: true }));
          otherTip.dispatchEvent(new Event("change", { bubbles: true }));
          otherTip.blur();
          await new Promise((resolve) => window.setTimeout(resolve, 150));
        }
      }

      const collapsedCart = [...document.querySelectorAll("button")].find(
        (button) =>
          /cart summary/i.test(button.textContent ?? "") &&
          button.getAttribute("aria-expanded") === "false",
      );

      if (collapsedCart instanceof HTMLButtonElement) {
        collapsedCart.click();
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }

      const pageLines = document.body.innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      function section(start: number, end: number): readonly string[] {
        return start >= 0 && end > start ? pageLines.slice(start, end) : [];
      }

      let safeLines: readonly string[] = [];

      if (window.location.hostname === "www.ubereats.com") {
        const pickupTime = pageLines.findIndex((line) => line === "Pickup time");
        const pickup = pageLines.lastIndexOf("Pickup", pickupTime);
        const payment = pageLines.findIndex(
          (line, index) => index > pickupTime && line === "Payment",
        );
        const cart = pageLines.findIndex((line) => /^Cart summary/i.test(line));
        const promotion = pageLines.findIndex(
          (line, index) => index > cart && line === "Promotion",
        );
        const orderTotal = pageLines.findIndex((line) => line === "Order total");
        const total = pageLines.findIndex(
          (line, index) => index > orderTotal && line === "Total",
        );

        safeLines = [
          ...section(pickup, payment),
          ...section(cart, promotion + 1),
          ...section(orderTotal, total + 2),
        ];
      } else if (window.location.hostname === "order.online") {
        const pickupDetails = pageLines.findIndex(
          (line) => line === "Pickup details",
        );
        const contact = pageLines.findIndex((line) => line === "Contact");
        const orderSummary = pageLines.findIndex(
          (line) => line === "Order summary",
        );
        const placeOrder = pageLines.findIndex(
          (line, index) => index > orderSummary && line === "Place Pickup Order",
        );
        const subtotal = pageLines.findIndex(
          (line, index) => index > placeOrder && line === "Subtotal",
        );
        const total = pageLines.findIndex(
          (line, index) => index > subtotal && line === "Total",
        );

        safeLines = [
          ...section(pickupDetails, contact),
          ...section(orderSummary, placeOrder),
          ...section(subtotal, total + 2),
        ];
      }

      return {
        url: window.location.href,
        text: safeLines.join("\n"),
        capturedAt: new Date().toISOString(),
      };
    },
  });

  if (!execution?.result) throw new Error("Could not read this checkout.");
  return execution.result;
}

async function storedQuotes(): Promise<Partial<Record<ProviderKind, PickupQuote>>> {
  const stored = await chrome.storage.session.get(CAPTURE_KEY);
  return stored[CAPTURE_KEY] ?? {};
}

async function render(): Promise<void> {
  const captures = await storedQuotes();
  const quotes = Object.values(captures);

  quoteList.replaceChildren(
    ...quotes.map((quote) => {
      const card = document.createElement("article");
      card.className = "quote";

      const provider = document.createElement("strong");
      provider.textContent = providerName(quote.provider);
      const total = document.createElement("span");
      total.textContent = `${formatMoney(quote.totalCents)} · ${quote.cart.length} cart line${quote.cart.length === 1 ? "" : "s"}`;
      const restaurant = document.createElement("span");
      restaurant.textContent = quote.restaurantName;

      card.append(provider, total, restaurant);
      return card;
    }),
  );

  if (quotes.length === 2) {
    const comparison = new QuoteComparison(quotes[0], quotes[1]).result;
    const card = document.createElement("article");
    card.className = "comparison";
    const headline = document.createElement("strong");
    headline.textContent = comparison.message;
    const detail = document.createElement("span");
    detail.textContent =
      comparison.savingsCents === null
        ? "Fix the mismatch before trusting the result."
        : `Difference: ${formatMoney(comparison.savingsCents)}`;
    card.append(headline, detail);
    quoteList.append(card);
  }
}

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  status.textContent = "Reading the visible checkout…";

  try {
    const snapshot = await readCheckoutPage();
    const parser = parserFor(snapshot.url);
    if (!parser) throw new Error("This checkout is not supported yet.");

    const quote = parser.parse(snapshot);
    const captures = await storedQuotes();
    captures[quote.provider] = quote;
    await chrome.storage.session.set({ [CAPTURE_KEY]: captures });
    status.textContent = `${providerName(quote.provider)} captured. Open the other channel to compare.`;
    await render();
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : "The checkout could not be read.";
  } finally {
    captureButton.disabled = false;
  }
});

clearButton.addEventListener("click", async () => {
  await chrome.storage.session.remove(CAPTURE_KEY);
  status.textContent = "Captures cleared.";
  await render();
});

await render();
