export default async () => ({
  emits: ["select-match", "join-match", "delete-match"],
  props: {
    match: {
      type: Object,
      required: true,
    },
    pendingMatchId: {
      type: String,
      required: true,
    },
    joiningMatchId: {
      type: String,
      required: true,
    },
    deletingMatchId: {
      type: String,
      required: true,
    },
  },
  template: await fetch(new URL("./index.html", import.meta.url)).then((response) =>
    response.text(),
  ),
});
