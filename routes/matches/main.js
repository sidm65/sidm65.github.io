import { onMounted } from "vue";
import { useCourtConnectStore } from "../../store.js";

function setup() {
  const store = useCourtConnectStore();

  onMounted(() => {
    store.refreshMatches();
    store.refreshProfiles();
  });

  return { store };
}

export default async () => ({
  components: {
    MatchCard: await import("../../components/match-card/main.js").then((module) =>
      module.default(),
    ),
  },
  setup,
  template: await fetch(new URL("./index.html", import.meta.url)).then((response) =>
    response.text(),
  ),
});
