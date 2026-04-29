import { createApp, computed, ref, watch } from "vue";
import { GraffitiDecentralized } from "@graffiti-garden/implementation-decentralized";
import {
  GraffitiPlugin,
  useGraffiti,
  useGraffitiDiscover,
  useGraffitiSession,
} from "@graffiti-garden/wrapper-vue";

const profileChannel = "sidmdesignftw";
const chatDirectoryChannel = "sidmdesignftw-chats";
const lobbyChannel = "sidmdesignftw-match-lobby";

const profileSchema = {
  properties: {
    value: {
      required: ["activity", "type", "name", "sports", "published"],
      properties: {
        activity: { const: "Create" },
        type: { const: "Profile" },
        name: { type: "string" },
        sports: { type: "array" },
        published: { type: "number" },
      },
    },
  },
};

const chatSchema = {
  properties: {
    value: {
      required: ["activity", "type", "channel", "participants", "published"],
      properties: {
        activity: { const: "Create" },
        type: { const: "Chat" },
        channel: { type: "string" },
        participants: { type: "array" },
        published: { type: "number" },
      },
    },
  },
};

const messageSchema = {
  properties: {
    value: {
      required: ["activity", "type", "content", "published"],
      properties: {
        activity: { const: "Send" },
        type: { const: "Message" },
        content: { type: "string" },
        published: { type: "number" },
      },
    },
  },
};

const matchSchema = {
  properties: {
    value: {
      required: ["activity", "type", "published"],
      properties: {
        activity: { enum: ["Post", "Join"] },
        type: { type: "string" },
        published: { type: "number" },
      },
    },
  },
};

function dmChannel(a, b) {
  return "sidmdesignftw-dm-" + [a, b].sort().join("-");
}

function buildProfileValue(form) {
  return {
    activity: "Create",
    type: "Profile",
    name: form.name,
    sports: [...form.sports],
    published: Date.now(),
  };
}

function buildChatValue(channel, actorA, actorB, nameA, nameB) {
  return {
    activity: "Create",
    type: "Chat",
    channel,
    participants: [actorA, actorB],
    names: [nameA, nameB],
    published: Date.now(),
  };
}

function buildMessageValue(content) {
  return {
    activity: "Send",
    type: "Message",
    content,
    published: Date.now(),
  };
}

function buildMatchValue(form) {
  return {
    activity: "Post",
    type: "Match",
    sport: form.sport,
    location: form.location,
    ratingType: form.ratingType,
    rating: Number(form.rating),
    format: form.format,
    date: form.date,
    time: form.time,
    costPerSpot: Number(form.costPerSpot),
    openSeats: form.format === "singles" ? 1 : 3,
    matchId: crypto.randomUUID(),
    published: Date.now(),
  };
}

function buildJoinValue(matchId) {
  return {
    activity: "Join",
    type: "Match",
    target: matchId,
    published: Date.now(),
  };
}

function setup() {
  const graffiti = useGraffiti();
  const session = useGraffitiSession();
  const view = ref("chats");
  const selectedActor = ref("");
  const pendingMatchId = ref("");
  const openingChatFor = ref("");
  const localChatChannels = ref({});
  const profileForm = ref({ name: "", sports: [] });
  const matchForm = ref({
    sport: "tennis",
    location: "MIT",
    ratingType: "UTR",
    rating: 4,
    format: "singles",
    date: "",
    time: "",
    costPerSpot: 0,
  });
  const messageText = ref("");
  const savingProfile = ref(false);
  const postingMatch = ref(false);
  const sendingMessage = ref(false);
  const joiningMatchId = ref("");
  const deletingMatchId = ref("");
  const profileError = ref("");
  const profileLoaded = ref(false);

  const { objects: profileObjects, isFirstPoll: profilesLoading } =
    useGraffitiDiscover(
      [profileChannel],
      profileSchema,
      undefined,
      true,
    );

  const latestProfiles = computed(() => {
    const byActor = {};
    for (const object of profileObjects.value) {
      if (!byActor[object.actor] || byActor[object.actor].value.published < object.value.published) {
        byActor[object.actor] = object;
      }
    }
    return Object.values(byActor);
  });

  const myActor = computed(() => session.value?.actor || "");

  const myProfile = computed(() => {
    return latestProfiles.value.find((object) => object.actor === myActor.value);
  });

  const profileReady = computed(() => !!myProfile.value);
  const appReady = computed(() => !!session.value && profileReady.value);
  const normalizedProfileName = computed(() => profileForm.value.name.trim().toLowerCase());
  const duplicateName = computed(() => {
    if (!normalizedProfileName.value) {
      return false;
    }
    return latestProfiles.value.some(
      (object) =>
        object.actor !== myActor.value &&
        object.value.name.trim().toLowerCase() === normalizedProfileName.value,
    );
  });
  const canSaveProfile = computed(() => {
    return !!profileForm.value.name.trim() && profileForm.value.sports.length > 0 && !duplicateName.value;
  });

  const people = computed(() => {
    return latestProfiles.value
      .filter((object) => object.actor !== myActor.value)
      .toSorted((a, b) => a.value.name.localeCompare(b.value.name));
  });

  const profileNames = computed(() => {
    return Object.fromEntries(
      latestProfiles.value.map((object) => [object.actor, object.value.name]),
    );
  });

  const activePerson = computed(() => {
    return people.value.find((object) => object.actor === selectedActor.value);
  });

  const { objects: chatObjects } = useGraffitiDiscover(
    [chatDirectoryChannel],
    chatSchema,
    session,
    true,
  );

  const myChats = computed(() => {
    return chatObjects.value.filter((object) => object.value.participants.includes(myActor.value));
  });

  const activeChat = computed(() => {
    if (!myActor.value || !selectedActor.value) {
      return undefined;
    }
    return myChats.value
      .filter((object) => object.value.participants.includes(selectedActor.value))
      .toSorted((a, b) => b.value.published - a.value.published)[0];
  });

  const activeMessageChannels = computed(() => {
    const channel = activeChat.value?.value.channel || localChatChannels.value[selectedActor.value];
    if (!channel) {
      return [];
    }
    return [channel];
  });
  const chatReady = computed(() => activeMessageChannels.value.length > 0);

  const { objects: messageObjects, isFirstPoll: messagesLoading } =
    useGraffitiDiscover(
      activeMessageChannels,
      messageSchema,
      session,
      true,
    );

  const sortedMessages = computed(() => {
    return messageObjects.value
      .toSorted((a, b) => a.value.published - b.value.published)
      .map((message) => ({
        ...message,
        mine: message.actor === myActor.value,
      }));
  });

  const { objects: matchObjects, isFirstPoll: matchesLoading } =
    useGraffitiDiscover(
      [lobbyChannel],
      matchSchema,
      undefined,
      true,
    );

  const matchPosts = computed(() => {
    return matchObjects.value
      .filter((object) => object.value.activity === "Post" && object.value.type === "Match")
      .toSorted((a, b) => b.value.published - a.value.published);
  });

  const joinObjects = computed(() => {
    return matchObjects.value.filter(
      (object) => object.value.activity === "Join" && object.value.type === "Match",
    );
  });

  const matchCards = computed(() => {
    return matchPosts.value.map((match) => {
      const joiners = joinObjects.value
          .filter((object) => object.value.target === match.value.matchId)
          .toSorted((a, b) => a.value.published - b.value.published);
      const takenBy = [...new Set(joiners.map((object) => object.actor))];
      const seats = Array.from({ length: match.value.openSeats }, (_, index) => {
        const actor = takenBy[index];
        return actor
          ? {
              open: false,
              label: profileNames.value[actor] || "Player",
            }
          : {
              open: true,
              label: "Open Seat",
            };
      });
      const joinCount = takenBy.length;
      return {
        ...match,
        joinCount,
        mine: match.actor === myActor.value,
        joined: takenBy.includes(myActor.value),
        full: joinCount >= match.value.openSeats,
        seats,
      };
    });
  });

  const canPostMatch = computed(() => {
    const rating = Number(matchForm.value.rating);
    const cost = Number(matchForm.value.costPerSpot);
    return (
      matchForm.value.date &&
      matchForm.value.time &&
      Number.isFinite(rating) &&
      rating >= 1 &&
      rating <= 16 &&
      Number.isFinite(cost) &&
      cost >= 0
    );
  });

  watch(
    myProfile,
    (profile) => {
      if (profile && !profileLoaded.value) {
        profileForm.value = {
          name: profile.value.name,
          sports: [...profile.value.sports],
        };
        profileLoaded.value = true;
      }
    },
    { immediate: true },
  );

  async function saveProfile() {
    if (!canSaveProfile.value) {
      profileError.value = duplicateName.value ? "That nickname is already taken." : "";
      return;
    }
    savingProfile.value = true;
    profileError.value = "";
    try {
      await graffiti.post(
        {
          value: buildProfileValue(profileForm.value),
          channels: [profileChannel],
        },
        session.value,
      );
      profileLoaded.value = true;
    } finally {
      savingProfile.value = false;
    }
  }

  async function ensureChat(actor) {
    const existingChat = myChats.value.find((object) => object.value.participants.includes(actor));
    if (existingChat) {
      localChatChannels.value = {
        ...localChatChannels.value,
        [actor]: existingChat.value.channel,
      };
      return existingChat;
    }
    const person = people.value.find((object) => object.actor === actor);
    const channel = dmChannel(myActor.value, actor);
    localChatChannels.value = {
      ...localChatChannels.value,
      [actor]: channel,
    };
    await graffiti.post(
      {
        value: buildChatValue(
          channel,
          myActor.value,
          actor,
          myProfile.value?.value.name || "",
          person?.value.name || "",
        ),
        channels: [chatDirectoryChannel],
        allowed: [myActor.value, actor],
      },
      session.value,
    );
    return { value: { channel } };
  }

  async function sendMessage() {
    if (!activeMessageChannels.value.length) {
      return;
    }
    sendingMessage.value = true;
    try {
      await graffiti.post(
        {
          value: buildMessageValue(messageText.value),
          channels: activeMessageChannels.value,
          allowed: [myActor.value, selectedActor.value],
        },
        session.value,
      );
      messageText.value = "";
    } finally {
      sendingMessage.value = false;
    }
  }

  async function postMatch() {
    postingMatch.value = true;
    try {
      await graffiti.post(
        {
          value: buildMatchValue(matchForm.value),
          channels: [lobbyChannel],
        },
        session.value,
      );
      matchForm.value = {
        sport: "tennis",
        location: "MIT",
        ratingType: "UTR",
        rating: 4,
        format: "singles",
        date: "",
        time: "",
        costPerSpot: 0,
      };
    } finally {
      postingMatch.value = false;
    }
  }

  async function joinMatch(match) {
    joiningMatchId.value = match.value.matchId;
    try {
      await graffiti.post(
        {
          value: buildJoinValue(match.value.matchId),
          channels: [lobbyChannel],
        },
        session.value,
      );
      pendingMatchId.value = "";
    } finally {
      joiningMatchId.value = "";
    }
  }

  async function deleteMatch(match) {
    deletingMatchId.value = match.url;
    try {
      await graffiti.delete(match, session.value);
      if (pendingMatchId.value === match.value.matchId) {
        pendingMatchId.value = "";
      }
    } finally {
      deletingMatchId.value = "";
    }
  }

  async function selectPerson(actor) {
    selectedActor.value = actor;
    view.value = "chats";
    openingChatFor.value = actor;
    try {
      await ensureChat(actor);
    } finally {
      openingChatFor.value = "";
    }
  }

  return {
    view,
    profileReady,
    appReady,
    profileForm,
    matchForm,
    messageText,
    canSaveProfile,
    duplicateName,
    savingProfile,
    postingMatch,
    sendingMessage,
    joiningMatchId,
    deletingMatchId,
    openingChatFor,
    pendingMatchId,
    profileError,
    profilesLoading,
    messagesLoading,
    matchesLoading,
    people,
    activePerson,
    activeChat,
    chatReady,
    sortedMessages,
    matchCards,
    canPostMatch,
    saveProfile,
    sendMessage,
    postMatch,
    joinMatch,
    deleteMatch,
    selectPerson,
  };
}

createApp({ template: "#template", setup })
  .use(GraffitiPlugin, {
    graffiti: new GraffitiDecentralized(),
  })
  .mount("#app");
