import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

const router = Router();

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${env.FRONTEND_URL}/login`,
  }),
  (req, res) => {
    const user = req.user as Record<string, unknown>;

    const token = jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });

    res.redirect(`${env.FRONTEND_URL}/auth-success?token=${token}`);
  }
);

export default router;
