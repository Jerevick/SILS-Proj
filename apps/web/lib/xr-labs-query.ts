/** Query keys for XR labs (TanStack Query). */
export const XR_LABS_QUERY_KEY = ["xr", "labs"] as const;
export const XR_LAB_DETAIL_QUERY_KEY = (labId: string) => ["xr", "labs", labId] as const;
