/**
 * Response structure for X-Ray URL generation
 */
export interface GenerateXRayResponse {
  /** Direct URL to Morningstar X-Ray PDF report */
  morningstarUrl: string;

  /** Shareable app URL with portfolio encoded in query params */
  shareableUrl: string;
}
