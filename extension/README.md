# Sidewalk browser companion

This TypeScript Chrome extension is the data-acquisition POC for Sidewalk. It
captures an exact pickup quote from an open checkout and compares it with a
capture from the same restaurant's other ordering channel.

The spike currently supports:

- Uber Eats checkout pages
- DoorDash Commerce Platform storefront checkouts on `order.online`
- arbitrary cart items, quantities, and visible modifiers
- exact subtotal, tax, fee, discount, tip, and total reconciliation
- signed-in account benefits shown by the checkout
- basket- and restaurant-mismatch rejection
- automatic `$0` pickup-tip normalization on DoorDash storefronts
- session-only storage of normalized quote fields

Raw page text, cookies, payment information, contact information, query
parameters, and checkout identifiers are not stored. The extension has no code
path that presses a final order button.

## Build

```bash
npm run build:extension
```

The unpacked extension is emitted to `extension/dist`. In Chrome's extension
manager, enable developer mode and choose **Load unpacked** to test that folder.
Opening the extension on a supported checkout captures it immediately; the
button remains available to retry after the checkout changes.

## Current boundary

The collector can compare two equivalent open carts without predefined
"supported baskets." It does not yet replicate a source cart into the second
provider. Basket replication is the next experiment and will reuse the captured
item, quantity, and modifier structure only after extraction reliability passes
across multiple restaurants.
