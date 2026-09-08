import { useEffect, useState } from "react";
export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const next = blob ? URL.createObjectURL(blob) : undefined;
    // Object URL lifetime follows the mounted media, never the persisted record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(next);
    return () => {
      if (next) URL.revokeObjectURL(next);
    };
  }, [blob]);
  return url;
}
