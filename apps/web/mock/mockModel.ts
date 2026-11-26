import type { Model } from '@app/translator/model-types'
import type { MockModel } from './mockState'

/** コードのブラウザのモデルから、開発パネルが読むところだけを抜き出す。 */
export function composeMockModel(model: Model): MockModel {
  const meetingTitles = new Map(model.meetings.map((meeting) => [meeting.id, meeting.title]))
  return {
    flows: model.flows,
    scenarios: model.scenarios.map((scenario) => ({ ...scenario, cases: undefined })),
    pages: model.pages,
    works: model.works.map((work) => ({ id: work.id, title: work.title })),
    estimateItems: model.estimates.flatMap((estimate) =>
      estimate.items.map((item, index) => ({
        number: index + 1,
        title: item.title,
        note: null,
        targets: item.targets,
        estimateId: estimate.id,
        estimateTitle: estimate.title,
      })),
    ),
    decisions: model.meetings.flatMap((meeting) =>
      meeting.decisions.map((decision) => ({ meetingId: meeting.id, date: meeting.date, meetingTitle: meeting.title, text: decision.text, places: decision.places })),
    ),
    questions: model.questions.map((question) => ({
      meetingId: question.meetingId,
      date: question.date,
      text: question.text,
      resolved: question.decision !== null,
      places: question.places,
      meetingTitle: meetingTitles.get(question.meetingId) ?? question.meetingId,
    })),
  }
}
