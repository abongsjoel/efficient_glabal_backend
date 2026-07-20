import { Router } from "express";
import { authenticateAdmin } from "../services/adminService.js";

const router = Router();

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const getStringValue = (value) =>
  typeof value === "string" ? value.trim() : "";

const validateAdminLogin = (body) => {
  const email = getStringValue(body.email);
  const password = getStringValue(body.password);
  const errors = {};

  if (!email) {
    errors.email = "Enter an email address.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!password) {
    errors.password = "Enter your password.";
  }

  return errors;
};

router.post("/login", async (req, res) => {
  const errors = validateAdminLogin(req.body);

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      message: "Please correct the highlighted fields.",
      errors,
    });
  }

  try {
    const admin = await authenticateAdmin({
      email: getStringValue(req.body.email),
      password: getStringValue(req.body.password),
    });

    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    return res.json({
      message: "Login successful.",
      admin,
    });
  } catch (error) {
    console.error("Admin login failed", {
      message: error.message,
    });

    return res.status(500).json({
      message: "We could not sign you in right now. Please try again later.",
    });
  }
});

export default router;
