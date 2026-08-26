// Shared fetch plumbing for the two upstream APIs.

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
