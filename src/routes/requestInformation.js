import { Router } from "express";

const router = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const phoneCharacterPattern = /^\+?[0-9\s().-]+$/;

const getStringValue = (value) => (typeof value === "string" ? value.trim() : "");

const validateRequestInformationSubmission = (body) => {
  const name = getStringValue(body.name);
  const email = getStringValue(body.email);
  const phone = getStringValue(body.phone);
  const message = getStringValue(body.message);
  const errors = {};
  const phoneDigits = phone.replace(/\D/g, "");

  if (!name) {
    errors.name = "Enter your name.";
  }

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

  if (!message) {
    errors.message = "Enter a message.";
  }

  return errors;
};

router.post("/", (req, res) => {
  const errors = validateRequestInformationSubmission(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors,
    });
  }

  const submission = {
    source: getStringValue(req.body.source) || "request-information",
    name: getStringValue(req.body.name),
    email: getStringValue(req.body.email),
    phone: getStringValue(req.body.phone),
    organization: getStringValue(req.body.organization),
    message: getStringValue(req.body.message),
    submittedAt: new Date().toISOString(),
  };

  console.info("Request information submission received", {
    source: submission.source,
    submittedAt: submission.submittedAt,
  });

  return res.status(201).json({
    message: "Request information submission received.",
  });
});

export default router;
