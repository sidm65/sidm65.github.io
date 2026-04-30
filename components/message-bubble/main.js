function formatTimestamp(timestamp) {
  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const date = new Date(timestamp);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) / 86400000,
  );

  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (dayDifference === 0) {
    return `Today at ${timeFormatter.format(date)}`;
  }

  if (dayDifference === 1) {
    return `Yesterday at ${timeFormatter.format(date)}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function setup(props) {
  return {
    formattedTimestamp: formatTimestamp(props.message.value.published),
  };
}

export default async () => ({
  props: {
    message: {
      type: Object,
      required: true,
    },
    mine: {
      type: Boolean,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
  },
  setup,
  template: await fetch(new URL("./index.html", import.meta.url)).then((response) =>
    response.text(),
  ),
});
