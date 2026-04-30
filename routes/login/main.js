import { useCourtConnectStore } from "../../store.js";

function setup() {
  const store = useCourtConnectStore();
  return { store };
}

export default async () => ({
  setup,
  template: await fetch(new URL("./index.html", import.meta.url)).then((response) =>
    response.text(),
  ),
});
