// 画面の通信が落ち着くのを待つ。実ブラウザでは、画面を開いた直後に画面が読み込みを続けて描き直す（Suspense）ので、
// その前に入れた値が消える。開発パネルは、シナリオの操作の前ごとに、通信が終わって少し静かになるまで待つ。
// 画面のモジュールより先に fetch を包む（開発パネルの入口から読む）。

let pendingCount = 0
const systemFetch = window.fetch.bind(window)

window.fetch = async (...parts: Parameters<typeof fetch>) => {
  pendingCount += 1
  try {
    return await systemFetch(...parts)
  } finally {
    pendingCount -= 1
  }
}

function waitMoment(milliseconds: number): Promise<void> {
  return new Promise((finish) => window.setTimeout(finish, milliseconds))
}

/** 通信が終わり、続けて 90 ミリ秒ほど新しい通信がない（描き直しが済んだ）ところまで待つ。10 秒で諦めて進む。 */
export async function settleScreen(): Promise<void> {
  const deadline = Date.now() + 10_000
  let quietCount = 0
  while (quietCount < 3 && Date.now() < deadline) {
    await waitMoment(30)
    quietCount = pendingCount === 0 ? quietCount + 1 : 0
  }
}
