import * as SecureStore from "expo-secure-store";
const BASE_URL_KEY = "BASE_URL";
const APP_KEY = "APP_KEY";

export const storage = {
  async getBase() { return (await SecureStore.getItemAsync(BASE_URL_KEY)) ?? ""; },
  async setBase(v: string) { await SecureStore.setItemAsync(BASE_URL_KEY, v); },
  async getKey() { return (await SecureStore.getItemAsync(APP_KEY)) ?? ""; },
  async setKey(v: string) { await SecureStore.setItemAsync(APP_KEY, v); },
};
