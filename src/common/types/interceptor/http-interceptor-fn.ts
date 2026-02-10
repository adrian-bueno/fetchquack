import { HttpInterceptorContext } from "./http-interceptor-context";
import { HttpInterceptorNext } from "./http-interceptor-next";
import { HttpInterceptorResponse } from "./http-interceptor-response";

/**
 * Function signature for HTTP interceptors.
 *
 * Interceptors can modify requests, handle responses, add headers, log activity,
 * implement retry logic, and more. They form a chain where each interceptor
 * can process the request before and after passing it to the next handler.
 *
 * **Interceptor responsibilities:**
 * 1. Modify the request context (headers, body, URL)
 * 2. Call `next(context)` to pass control to the next interceptor
 * 3. Process the response (transform data, handle errors)
 * 4. Return the response (modified or as-is)
 *
 * @example
 * ```typescript
 * // Simple logging interceptor
 * const loggingInterceptor: HttpInterceptorFn = async (ctx, next) => {
 *   console.log(`Request: ${ctx.method} ${ctx.url}`);
 *   const response = await next(ctx);
 *   console.log(`Response: ${response.status}`);
 *   return response;
 * };
 *
 * // Auth interceptor that adds token
 * const authInterceptor: HttpInterceptorFn = async (ctx, next) => {
 *   ctx.headers['Authorization'] = `Bearer ${getToken()}`;
 *   return next(ctx);
 * };
 *
 * // Error handling interceptor
 * const errorInterceptor: HttpInterceptorFn = async (ctx, next) => {
 *   try {
 *     return await next(ctx);
 *   } catch (error) {
 *     if (error.statusCode === 401) {
 *       // Handle unauthorized, refresh token, etc.
 *     }
 *     throw error;
 *   }
 * };
 * ```
 */
export type HttpInterceptorFn = (
  context: HttpInterceptorContext,
  next: HttpInterceptorNext
) => Promise<HttpInterceptorResponse>;
