import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useCourtConnectStore } from "../../store.js";

function setup() {
  const route = useRoute();
  const store = useCourtConnectStore();

  const actor = computed(() =>
    typeof route.params.actor === "string" ? route.params.actor : "",
  );

  const profile = computed(() => store.getProfileByActor(actor.value));

  onMounted(() => {
    store.refreshProfiles();
  });

  return {
    store,
    actor,
    profile,
  };
}

export default async () => ({
  setup,
  template: await fetch(new URL("./index.html", import.meta.url)).then((response) =>
    response.text(),
  ),
});
