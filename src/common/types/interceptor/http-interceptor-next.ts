import { HttpInterceptorContext } from "./http-interceptor-context";
import { HttpInterceptorResponse } from "./http-interceptor-response";

/**
 * Function to pass control to the next interceptor in the chain.
 *
 * Called by interceptors to continue request processing. The last interceptor
 * in the chain will invoke the actual fetch operation.
 *
 * **Important:** Interceptors MUST call `next(context)` to continue the chain,
 * unless they want to short-circuit (e.g., return cached response).
 *
 * @example
 * ```typescript
 * const interceptor: HttpInterceptorFn = async (ctx, next) => {
 *   // Pre-processing: modify request
 *   ctx.headers['X-Timestamp'] = Date.now().toString();
 *
 *   // Continue chain and wait for response
 *   const response = await next(ctx);
 *
 *   // Post-processing: log duration
 *   console.log(`Request took ${Date.now() - parseInt(ctx.headers['X-Timestamp'])}ms`);
 *
 *   return response;
 * };
 * ```
 */
export type HttpInterceptorNext = (
  context: HttpInterceptorContext
) => Promise<HttpInterceptorResponse>;
