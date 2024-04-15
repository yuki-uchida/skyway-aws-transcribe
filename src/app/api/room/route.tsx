import {NextRequest, NextResponse} from "next/server";
import jwt from "jsonwebtoken";
import {webcrypto as crypto} from "crypto";

const id = process.env.SKYWAY_APP_KEY as string;
const secret = process.env.SKYWAY_SECRET_KEY as string;
interface SkyWayCredential {
  channelName: string;
  memberName: string;
  iat: number;
  exp: number;
  authToken: string;
}
async function getSkyWayCredential(channelName: string, memberName: string) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = Math.floor(Date.now() / 1000) + 36000; // 10h=60*60*10
  const token = jwt.sign(
    {
      jti: crypto.randomUUID(),
      iat: iat,
      exp: exp,
      scope: {
        app: {
          id: id,
          turn: true,
          actions: ["read"],
          channels: [
            {
              id: "*",
              name: "*",
              actions: ["write"],
              members: [
                {
                  id: "*",
                  name: "*",
                  actions: ["write"],
                  publication: {
                    actions: ["write"],
                  },
                  subscription: {
                    actions: ["write"],
                  },
                },
              ],
              sfuBots: [
                {
                  actions: ["write"],
                  forwardings: [
                    {
                      actions: ["write"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    secret
  );
  const credential: SkyWayCredential = {
    channelName: channelName,
    memberName: memberName,
    iat: iat,
    exp: exp,
    authToken: token,
  };
  return credential;
}

const GET = async (request: NextRequest) => {
  const credential = await getSkyWayCredential(
    request.nextUrl.searchParams.get("roomId") ?? "",
    request.nextUrl.searchParams.get("memberName") ?? ""
  );

  return NextResponse.json(credential);
};

export {GET};
