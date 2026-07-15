import { Router } from "express";
import { sendDeliveryRequestEmail } from "../services/deliveryRequestEmail.js";

const router = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneCharacterPattern = /^\+?[0-9\s().-]+$/;

const getStringValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateContactFields = (body) => {
  const email = getStringValue(body.email);
  const phone = getStringValue(body.phone);
  const errors = {};
  const phoneDigits = phone.replace(/\D/g, "");

  if (!email) {
    errors.email = "Enter an email address.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!phone) {
    errors.phone = "Enter a phone number.";
  } else if (
    !phoneCharacterPattern.test(phone) ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15
  ) {
    errors.phone = "Enter a valid phone number.";
  }

  return errors;
};

const validateDeliveryRequestSubmission = (body) => {
  const errors = {};
  const requiredFields = [
    { name: "pickup", message: "Enter a pickup location." },
    { name: "delivery", message: "Enter a delivery location." },
    { name: "datetime", message: "Select a date and time." },
    { name: "vehicle", message: "Select a request type." },
    { name: "name", message: "Enter your name." },
    { name: "rush", message: "Select whether rush delivery is required." },
  ];

  requiredFields.forEach(({ name, message }) => {
    if (!getStringValue(body[name])) {
      errors[name] = message;
    }
  });

  return {
    ...errors,
    ...validateContactFields(body),
  };
};

router.post("/", async (req, res) => {
  const errors = validateDeliveryRequestSubmission(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors,
    });
  }

  const submission = {
    source: getStringValue(req.body.source) || "schedule-delivery",
    pickup: getStringValue(req.body.pickup),
    delivery: getStringValue(req.body.delivery),
    datetime: getStringValue(req.body.datetime),
    vehicle: getStringValue(req.body.vehicle),
    name: getStringValue(req.body.name),
    email: getStringValue(req.body.email),
    phone: getStringValue(req.body.phone),
    rush: getStringValue(req.body.rush),
    instructions: getStringValue(req.body.instructions),
    submittedAt: new Date().toISOString(),
  };

  try {
    const email = await sendDeliveryRequestEmail(submission);

    console.info("Delivery request email sent", {
      emailId: email?.id,
      source: submission.source,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    console.error("Delivery request email failed", {
      message: error.message,
      source: submission.source,
      submittedAt: submission.submittedAt,
    });

    return res.status(502).json({
      message:
        "We could not send your delivery request right now. Please try again later.",
    });
  }

  return res.status(201).json({
    message: "Delivery request submission received.",
  });
});

export default router;
