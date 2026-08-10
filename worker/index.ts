/** Cloudflare Worker entry point required by the Sites runtime. */
import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

interface ImageService {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: {
        format: string;
        quality: number;
      }): Promise<{ response(): Response }>;
    };
  };
}

interface WorkerEnvironment {
  ASSETS: AssetFetcher;
  IMAGES: ImageService;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(
    request: Request,
    environment: WorkerEnvironment,
    context: WorkerExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];

      return handleImageOptimization(
        request,
        {
          fetchAsset: (path) =>
            environment.ASSETS.fetch(new Request(new URL(path, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const image = environment.IMAGES.input(body);
            const transformed = image.transform(width > 0 ? { width } : {});
            return (await transformed.output({ format, quality })).response();
          },
        },
        allowedWidths,
      );
    }

    return handler.fetch(request, environment, context);
  },
};
