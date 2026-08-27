import React from "react";
import { Image } from "react-native";

export const LogoHeader = () => (
  <Image
    source={require("../../assets/images/vennex-logo.png")}
    style={{ width: 110, height: 32, resizeMode: "contain" }}
  />
);