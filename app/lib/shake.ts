import { useEffect } from "react";
import { Accelerometer } from "expo-sensors";
import { router } from "expo-router";

export function useShakeNavigation() {
  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    let last = 0;
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const force = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (force > 2.4 && now - last > 2500) {
        last = now;
        router.push("/vent");
      }
    });
    return () => sub.remove();
  }, []);
}
