'use server';

import { cookies } from 'next/headers';

export async function createCookies(name, token) {
  const jar = await cookies();
  jar.set(name, token);
}

export async function deleteCookies(name) {
  const jar = await cookies();
  jar.delete(name);
}

export async function getCookie(name) {
  const jar = await cookies();
  const cookieValue = jar.get(name);
  if (cookieValue) {
    return cookieValue.value;
  }
  return null;
}
