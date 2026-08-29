import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { env } from "./env";
import prisma from "./prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: Profile,
      done
    ) => {
      try {
        const googleId = profile.id;
        const name     = profile.displayName;
        const email    = (profile.emails?.[0]?.value ?? "").toLowerCase().trim();
        const avatar   = profile.photos?.[0]?.value ?? "";

        // Upsert user — create on first login, update profile on subsequent logins
        const user = await prisma.user.upsert({
          where: { googleId },
          update: { name, email, avatar },
          create: { googleId, name, email, avatar },
        });

        return done(null, user);
      } catch (error) {
        return done(error as Error, false);
      }
    }
  )
);

export default passport;
