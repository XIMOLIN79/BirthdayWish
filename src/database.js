import { db } from "./firebase";
import { get, push, ref } from "firebase/database";

export async function saveWish(name, message, imageData = "") {
  const wishesRef = ref(db, "wishes");

  await push(wishesRef, {
    name: name.trim() || "一位朋友",
    message: message.trim(),
    imageData,
    time: Date.now(),
  });
}

export async function getWishes() {
  const snapshot = await get(ref(db, "wishes"));

  if (!snapshot.exists()) {
    return [];
  }

  return Object.entries(snapshot.val())
    .map(([id, item]) => ({
      id,
      name: item.name || "一位朋友",
      message: item.message || "",
      imageData: item.imageData || "",
      time: item.time || 0,
    }))
    .filter((wish) => wish.message)
    .sort((a, b) => a.time - b.time);
}