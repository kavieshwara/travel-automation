import { bookingConfig } from "./config.js";

const sessions = new Map();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function numberedOptions(items) {
  return items.map((item, index) => `${index + 1}. ${typeof item === "string" ? item : item.label}`).join("\n");
}

function optionRows(items) {
  return items.map((item) => {
    const label = typeof item === "string" ? item : item.label;
    return {
      id: label,
      title: label,
      description: typeof item === "string" ? "" : item.note || item.vehicle || "",
    };
  });
}

function listReply({ text, buttonText, sectionTitle, rows }) {
  return {
    type: "options",
    buttonText,
    title: bookingConfig.agency.name,
    footer: "Tap an option to continue",
    sections: [{ title: sectionTitle, rows }],
  };
}

function chooseByTextOrNumber(input, items) {
  const text = normalize(input);
  const number = Number.parseInt(text, 10);
  if (Number.isInteger(number) && number >= 1 && number <= items.length) {
    return items[number - 1];
  }
  return items.find((item) => {
    const label = typeof item === "string" ? item : item.label;
    return normalize(label) === text || normalize(label).includes(text) || text.includes(normalize(label));
  });
}

function isStartMessage(input) {
  const text = normalize(input);
  return (
    ["start", "restart", "book", "hi", "hello"].includes(text) ||
    text.includes("book a trip") ||
    text.includes("plan my trip") ||
    text.includes("want to book")
  );
}

function initialSession(customerId, profile = {}) {
  return {
    id: customerId,
    profile: {
      name: profile.name || "there",
      phone: profile.phone || customerId,
      email: "",
    },
    step: "city",
    city: "",
    passengers: null,
    package: null,
    vehicle: "",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };
}

function touch(session, inboundText) {
  session.updatedAt = new Date().toISOString();
  if (inboundText) {
    session.history.push({
      at: session.updatedAt,
      from: "customer",
      text: inboundText,
    });
  }
}

function recordBot(session, messages) {
  const at = new Date().toISOString();
  messages.forEach((text) => session.history.push({ at, from: "bot", text }));
}

export function resetSession(customerId) {
  sessions.delete(customerId);
}

export function getSession(customerId) {
  return sessions.get(customerId);
}

export function listSessions() {
  return [...sessions.values()];
}

export function bookingSummary(session) {
  const customer = session.profile.name && session.profile.name !== "there" ? session.profile.name : "Customer";
  return [
    "Karthik Travels booking request",
    "",
    `Customer: ${customer}`,
    `Customer WhatsApp: ${session.profile.phone || session.id}`,
    session.profile.email ? `Customer email: ${session.profile.email}` : null,
    `Pickup city: ${session.city || "Not selected"}`,
    `Passengers: ${session.passengers?.label || "Not selected"}`,
    `Recommended vehicle: ${session.vehicle || "Not selected"}`,
    `Package: ${session.package?.label || "Not selected"}`,
    session.package?.note ? `Package note: ${session.package.note}` : null,
    "",
    "Please follow up with availability, final price, pickup time and advance payment details.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function customerSummary(session) {
  return [
    `Thank you for choosing ${bookingConfig.agency.name}. Your booking request has been received.`,
    "",
    `Pickup city: ${session.city}`,
    `Passengers: ${session.passengers.label}`,
    `Recommended vehicle: ${session.vehicle}`,
    `Package: ${session.package.label}`,
    "",
    "Our travel desk will contact you shortly with availability and final pricing.",
  ].join("\n");
}

function rateGuideMessage() {
  const formatRate = (rate) => {
    if (rate.freeKm === "-") {
      return `${rate.vehicle}: Day basis. Plains ${rate.plainsPackage}, extra ${rate.plainsExtraKm}. Hills ${rate.hillsPackage}, extra ${rate.hillsExtraKm}.`;
    }
    return `${rate.vehicle}: Local ${rate.fare} / ${rate.minimum}, ${rate.freeKm} free, extra ${rate.localExtraKm}, extra hour ${rate.extraHour}. Plains ${rate.plainsPackage}, extra ${rate.plainsExtraKm}. Hills ${rate.hillsPackage}, extra ${rate.hillsExtraKm}.`;
  };

  return [
    "Karthik Travels rate guide",
    "",
    ...bookingConfig.rateCard.map(formatRate),
    "",
    "Final pricing may change based on destination, route, pickup point, timing and permits.",
  ].join("\n");
}

function bookingDisclaimerMessage() {
  return [
    "Important booking disclaimer",
    "",
    ...bookingConfig.bookingDisclaimer.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");
}

function cityPrompt() {
  return `${bookingConfig.templates.cityPrompt}\n${numberedOptions(bookingConfig.cities)}`;
}

function passengerPrompt() {
  return `${bookingConfig.templates.passengerPrompt}\n${numberedOptions(bookingConfig.passengers)}`;
}

function packagePrompt(session) {
  return [
    `For ${session.passengers.label}, we recommend: ${session.vehicle}.`,
    "",
    `${bookingConfig.templates.packagePrompt}\n${numberedOptions(bookingConfig.packages)}`,
  ].join("\n");
}

function confirmationPrompt(session) {
  return [
    "Great. Here is what I have so far:",
    `Pickup city: ${session.city}`,
    `Passengers: ${session.passengers.label}`,
    `Recommended vehicle: ${session.vehicle}`,
    `Package: ${session.package.label}`,
    "",
    "If you want an email copy, send your email now. Otherwise choose:",
    numberedOptions(bookingConfig.confirmations),
  ].join("\n");
}

function promptForStep(session, page = 1) {
  const startIndex = page === 2 ? 2 : 0;
  if (session.step === "city") {
    const rows = optionRows(bookingConfig.cities).slice(startIndex);
    const text = page === 2 ? `More pickup cities:\n${numberedOptions(bookingConfig.cities.slice(startIndex))}` : cityPrompt();
    return {
      text,
      interactive: listReply({ text, buttonText: "Choose city", sectionTitle: "Pickup city", rows }),
    };
  }
  if (session.step === "passengers") {
    const rows = optionRows(bookingConfig.passengers).slice(startIndex);
    const text =
      page === 2 ? `More passenger options:\n${numberedOptions(bookingConfig.passengers.slice(startIndex))}` : passengerPrompt();
    return {
      text,
      interactive: listReply({ text, buttonText: "Choose passengers", sectionTitle: "Passengers", rows }),
    };
  }
  if (session.step === "package") {
    const rows = optionRows(bookingConfig.packages).slice(startIndex);
    const text =
      page === 2
        ? `More package options:\n${numberedOptions(bookingConfig.packages.slice(startIndex))}`
        : packagePrompt(session);
    return {
      text,
      interactive: listReply({ text, buttonText: "Choose package", sectionTitle: "Package", rows }),
    };
  }
  const rows = optionRows(bookingConfig.confirmations).slice(startIndex);
  const text =
    page === 2
      ? `More confirmation options:\n${numberedOptions(bookingConfig.confirmations.slice(startIndex))}`
      : confirmationPrompt(session);
  return {
    text,
    interactive: listReply({ text, buttonText: "Choose action", sectionTitle: "Confirmation", rows }),
  };
}

export function processBookingMessage({ customerId, text, profile = {} }) {
  const inbound = text.trim();
  let session = sessions.get(customerId);
  const replies = [];
  const interactiveReplies = [];
  const notifications = [];

  if (!session || ["complete", "cancelled"].includes(session.status) || isStartMessage(inbound)) {
    session = initialSession(customerId, profile);
    sessions.set(customerId, session);
    touch(session, inbound);
    replies.push(`${bookingConfig.templates.greeting}\n\n${cityPrompt()}`);
    interactiveReplies.push(
      listReply({
        text: replies[0],
        buttonText: "Choose city",
        sectionTitle: "Pickup city",
        rows: optionRows(bookingConfig.cities),
      }),
    );
    recordBot(session, replies);
    return { session, replies, interactiveReplies, notifications };
  }

  touch(session, inbound);

  if (normalize(inbound) === "__more__" || normalize(inbound) === "more options") {
    const prompt = promptForStep(session, 2);
    replies.push(prompt.text);
    interactiveReplies.push(prompt.interactive);
    recordBot(session, replies);
    return { session, replies, interactiveReplies, notifications };
  }

  if (EMAIL_PATTERN.test(inbound)) {
    session.profile.email = inbound;
    replies.push(`Thanks, I saved ${inbound} for the email copy.`);
    if (session.step === "confirm") {
      replies.push(confirmationPrompt(session));
      interactiveReplies[1] = listReply({
        text: replies[1],
        buttonText: "Choose action",
        sectionTitle: "Confirmation",
        rows: optionRows(bookingConfig.confirmations),
      });
    }
    recordBot(session, replies);
    return { session, replies, interactiveReplies, notifications };
  }

  if (session.step === "city") {
    const city = chooseByTextOrNumber(inbound, bookingConfig.cities);
    if (!city) {
      replies.push(`I could not match that city.\n\n${cityPrompt()}`);
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose city",
          sectionTitle: "Pickup city",
          rows: optionRows(bookingConfig.cities),
        }),
      );
    } else {
      session.city = city;
      session.step = "passengers";
      replies.push(`Pickup city selected: ${city}.\n\n${passengerPrompt()}`);
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose passengers",
          sectionTitle: "Passengers",
          rows: optionRows(bookingConfig.passengers),
        }),
      );
    }
  } else if (session.step === "passengers") {
    const passengers = chooseByTextOrNumber(inbound, bookingConfig.passengers);
    if (!passengers) {
      replies.push(`I could not match that passenger option.\n\n${passengerPrompt()}`);
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose passengers",
          sectionTitle: "Passengers",
          rows: optionRows(bookingConfig.passengers),
        }),
      );
    } else {
      session.passengers = passengers;
      session.vehicle = passengers.vehicle;
      session.step = "package";
      replies.push(packagePrompt(session));
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose package",
          sectionTitle: "Package",
          rows: optionRows(bookingConfig.packages),
        }),
      );
    }
  } else if (session.step === "package") {
    const packageChoice = chooseByTextOrNumber(inbound, bookingConfig.packages);
    if (!packageChoice) {
      replies.push(`I could not match that package option.\n\n${packagePrompt(session)}`);
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose package",
          sectionTitle: "Package",
          rows: optionRows(bookingConfig.packages),
        }),
      );
    } else {
      session.package = packageChoice;
      session.step = "confirm";
      replies.push(confirmationPrompt(session));
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose action",
          sectionTitle: "Confirmation",
          rows: optionRows(bookingConfig.confirmations),
        }),
      );
    }
  } else if (session.step === "confirm") {
    const action = chooseByTextOrNumber(inbound, bookingConfig.confirmations);
    if (!action) {
      replies.push(`Please choose one of these options:\n${numberedOptions(bookingConfig.confirmations)}`);
      interactiveReplies.push(
        listReply({
          text: replies[0],
          buttonText: "Choose action",
          sectionTitle: "Confirmation",
          rows: optionRows(bookingConfig.confirmations),
        }),
      );
    } else if (action === "Confirm booking") {
      session.status = "complete";
      session.step = "complete";
      const ownerMessage = bookingSummary(session);
      const customerMessage = customerSummary(session);
      const rateMessage = rateGuideMessage();
      const disclaimerMessage = bookingDisclaimerMessage();
      replies.push(customerMessage);
      replies.push(rateMessage);
      replies.push(disclaimerMessage);
      notifications.push({ type: "owner-whatsapp", message: ownerMessage });
      notifications.push({ type: "owner-email", subject: "New Karthik Travels booking request", message: ownerMessage });
      if (session.profile.email) {
        notifications.push({
          type: "customer-email",
          to: session.profile.email,
          subject: "Your Karthik Travels booking request",
          message: [customerMessage, rateMessage, disclaimerMessage].join("\n\n"),
        });
      }
    } else if (action === "Need more details") {
      replies.push("Sure. Please tell us what details you need, and our travel desk will reply shortly.");
      notifications.push({
        type: "owner-whatsapp",
        message: `${session.profile.name || "A customer"} needs more details.\n\n${bookingSummary(session)}`,
      });
    } else if (action === "Talk to owner") {
      replies.push("No problem. I am forwarding this to the owner. You will receive a direct response shortly.");
      notifications.push({
        type: "owner-whatsapp",
        message: `${session.profile.name || "A customer"} wants to talk to the owner.\n\n${bookingSummary(session)}`,
      });
    } else if (action === "Cancel") {
      session.status = "cancelled";
      session.step = "cancelled";
      replies.push("Your booking request has been cancelled. You can message 'book' anytime to start again.");
    }
  }

  recordBot(session, replies);
  return { session, replies, interactiveReplies, notifications };
}
