import { useEffect } from "react";

let openModalCount = 0;

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (locked) {
      openModalCount++;
      if (openModalCount === 1) {
        document.body.style.overflow = "hidden";
      }
      return () => {
        openModalCount = Math.max(0, openModalCount - 1);
        if (openModalCount === 0) {
          document.body.style.overflow = "";
        }
      };
    }
  }, [locked]);
}
