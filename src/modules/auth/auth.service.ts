import bcrypt from "bcryptjs";
import { SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import config from "../../config";
import { jwtUtils } from "../../utils/jwt";
import { IGoogleLoginPayload, ILoginUserPayload, IRegisterUserPayload } from "./auth.interface";
import { googleClient } from "../../lib/googleAuth";

const registerUser = async (payload: IRegisterUserPayload) => {
  const {
    name,
    email,
    password,
    phone,
    role = Role.CUSTOMER,
    avatarUrl,
    defaultAddress,
    city,
    district,
    postalCode,
    alternatePhone,
  } = payload;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("User with this email already exists.");
  }

  if (phone) {
    const existingPhone = await prisma.user.findUnique({
      where: { phone },
    });
    if (existingPhone) {
      throw new Error("User with this phone number already exists.");
    }
  }

  const saltRounds = Number(config.bcrypt_salt_rounds) || 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const result = await prisma.$transaction(async (tx: any) => {
    const createdUser = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        avatarUrl,
      },
    });

    if (role === Role.CUSTOMER) {
      await tx.customer.create({
        data: {
          userId: createdUser.id,
          defaultAddress,
          city,
          district,
          postalCode,
          alternatePhone,
        },
      });
    }

    const userWithRelation = await tx.user.findUnique({
      where: { id: createdUser.id },
      include: {
        customer: true,
      },
    });

    return userWithRelation;
  });

  if (!result) {
    throw new Error("Failed to register user.");
  }

  const { password: _, ...userWithoutPassword } = result;
  return userWithoutPassword;
};

const loginUser = async (payload: ILoginUserPayload) => {
  const { email, password } = payload;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (user.deletedAt) {
    throw new Error("Account has been deactivated. Please contact support.");
  }

  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    throw new Error("Invalid email or password.");
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    (config.jwt_access_expires_in || "1d") as SignOptions["expiresIn"]
  );

  const refreshToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_refresh_secret,
    (config.jwt_refresh_expires_in || "7d") as SignOptions["expiresIn"]
  );

  return {
    accessToken,
    refreshToken,
  };
};

const refreshToken = async (token: string) => {
  const verifiedToken = jwtUtils.verifyToken(token, config.jwt_refresh_secret);

  if (!verifiedToken.success) {
    throw new Error(verifiedToken.error || "Invalid refresh token.");
  }

  const { id } = verifiedToken.data as { id: string };

  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  if (user.deletedAt) {
    throw new Error("Account has been deactivated.");
  }

  const jwtPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwtUtils.createToken(
    jwtPayload,
    config.jwt_access_secret,
    (config.jwt_access_expires_in || "1d") as SignOptions["expiresIn"]
  );

  return {
    accessToken,
  };
};

const googleLogin = async(payload: IGoogleLoginPayload) => {

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken : payload.idToken,
        audience : config.google_client_id
      })
      
    } catch (error) {
      
    }

  

}

export const authService = {
  registerUser,
  loginUser,
  refreshToken,
  googleLogin
};
