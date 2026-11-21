---
name: minutes
description: 打合せの文字起こしや手元のメモから、議事録（apps/web/meeting の TypeScript）を作って PR にする。Use when 打合せの文字起こし・メモ・録音の書き起こしを渡されて「議事録にして」と頼まれたとき、書いた議事録を直すように頼まれたとき。NOT for 議事録を伴わない業務フロー・シナリオ・画面・処理の変更（決まりは検査が教える）、議事録以外の文書。
---

# 文字起こしから議事録を作る

このリポジトリで AI に向けた指示は、この Skill だけである。書き方の決まりは、型・lint・`pnpm check`（CI と同じ）が止めるので、この Skill には議事録に固有の手順だけを書く。議事録の型と規則の正本は `docs/flow-rules.md` の7章。

## 1. 材料をそろえる

- 渡された文字起こし・メモから、打合せの日・題・出席者を読む。分からなければ、書く前に頼んだ人に聞く。
- 前の回までの未解決の課題を一覧にする。答えが今回の話に出ていないかを、あとで照らし合わせる。

```sh
pnpm model && node -e "const m=require('./apps/browser/generated/model.ja.json');for(const q of m.questions.filter((q)=>q.decision===null))console.log(q.id,q.deadline,q.text)"
```

- 文字起こしやメモは、リポジトリに入れない。

## 2. 話したことを分ける

文字起こしを頭から読み、話したことを次の3つに分ける。

1. **決めたこと**（`decide`）。前の回の課題に答えたものは、その課題も控える。
2. **課題**（`raise`）。まだ決まっておらず、だれかが答える必要があるもの。
3. **どちらでもないもの**（経緯・雑談・言い直し・確認だけのやりとり）。議事録には書かない。

## 3. 議事録を書く

`apps/web/meeting/meeting<日付>.ts` に1回分を書く（既存の議事録を手本にする）。

```ts
export const meeting20261017 = defineMeeting('2026-10-17', {
  title: '第2回（入金の業務）',
  attendees: [projectManager, engineer, accountant, approver],
  agenda: [paymentManagement, registerPayment],
  decisions: [
    decide(overpaymentRefund, '請求先から返金の依頼があれば返金し、なければ次の請求で差し引く', {
      question: meeting20261003.questions.overpaymentHandling,
    }),
    decide([extensionOf(registerPayment, 'unidentifiedPayer'), PaymentListPage], '振込人を特定できない入金は仮受にし、入金の一覧で顧客を特定する'),
  ],
  questions: {
    refundCreation: raise(createRefund, '返金を登録する画面で、振込先の口座まで入れるか', { assignee: accountant, deadline: '2026-10-31' }),
  },
})
```

- 人の名前・会社の名前は書かず、役割に置き換える。ない役割は `apps/web/role/role.ts` に足す。
- 決めたことと課題は、話した粒度に合う場所を指す。業務の流れの話なら業務フロー、1人の画面の操作の話ならシナリオ、うまくいかない場合の話なら `extensionOf(シナリオ, 拡張)`。決まったことが画面の部品・処理・規則に表れるなら、その関数も配列に並べる。
- 指す業務フロー・シナリオ・拡張がまだなければ、未着手のシナリオ・業務フロー・拡張を足して指す。名前は日本語から `pnpm vocabulary:find <日本語>` で引き、単語帳にない言葉は `packages/vocabulary/words` に説明つきで足す。
- 前の回の課題に答えたものは、決めたことの `question` でその課題を指す。
- 新しい課題には、答える役割（`assignee`）と期限（`deadline`）を書く。期限が話に出ていなければ次の打合せの日にし、PR の本文にそう書く。
- 文の言い回しは、話した人の言葉をなるべく残し、主語と目的語を補って1文で読めるようにする。

## 4. 実装を合わせる

話で変わった業務フロー・シナリオ・画面・テストは、同じ PR で直す。決めたことと実装が食い違わないようにする。どこまで直すかは、型のエラーと `pnpm check` の失敗が教える。

## 5. 確かめて PR にする

1. `pnpm check` を通す。止まったら、出た規則の問題に従って直す。決まりはそこに全部ある。
2. ブランチに commit し、PR を作る。題は「議事録: <日付> <題>」。本文には次を書く。
   - 決めたこと・新しい課題・解決した課題の数
   - 仮に置いた期限
   - 文字起こしで聞き取れなかったところ・どちらにも取れたところ（レビューで確かめてもらう）
3. 開発チームと先方のレビューで直すように言われたら、同じ手順で直す。一度書いた議事録を直すことはいとわない。
