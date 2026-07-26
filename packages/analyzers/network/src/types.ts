/**
 * Generic request record modeled on CDP's `Network.requestWillBeSent` /
 * `Network.loadingFinished` fields — deliberately decoupled from any
 * specific collector. No Step 5-8 collector currently emits network
 * events; this analyzer is built and fixture-tested against this shape so a
 * future collector (or a CDP `Network` domain listener added to
 * `collector-hermes`) can feed it directly.
 */
export interface NetworkRequest {
  readonly url: string;
  readonly method: string;
  readonly statusCode?: number;
  readonly startTime: number;
  readonly endTime?: number;
  readonly transferSize?: number;
  readonly failed?: boolean;
  readonly errorText?: string;
}
