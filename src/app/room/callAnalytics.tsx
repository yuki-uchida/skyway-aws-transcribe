import update from "immutability-helper";
import {Buffer} from "buffer";
import MicrophoneStream from "microphone-stream";
import {useState} from "react";
import {
  AudioStream,
  StartCallAnalyticsStreamTranscriptionCommand,
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";
import {pcmEncodeChunk} from "./pcmEncode";

export const useCallAnalytics = () => {
  const [agentAnalytics, setAgentAnalytics] = useState<
    {
      isPartial: boolean;
      transcript: string;
      sentiment?: string;
    }[]
  >([]);
  const client = new TranscribeStreamingClient({
    region: "ap-northeast-1",
    credentials: {
      accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY as string,
    },
  });
  const startStream = async (mic: MicrophoneStream) => {
    const audioStream = async function* () {
      const config: AudioStream.ConfigurationEventMember = {
        ConfigurationEvent: {
          ChannelDefinitions: [
            {
              ChannelId: 0,
              ParticipantRole: "AGENT",
            },
            {
              ChannelId: 1,
              ParticipantRole: "CUSTOMER",
            },
          ],
          PostCallAnalyticsSettings: {
            OutputLocation: process.env
              .NEXT_PUBLIC_AWS_TRANSCRIBE_S3_LOCATION as string,
            DataAccessRoleArn: process.env
              .NEXT_PUBLIC_AWS_DATA_ACCESS_ROLE_ARN as string,
          },
        },
      };
      yield config;

      for await (const chunk of mic as unknown as Buffer[]) {
        const audioEvent: AudioStream.AudioEventMember = {
          AudioEvent: {
            AudioChunk: pcmEncodeChunk(chunk),
          },
        };
        yield audioEvent;
      }
    };
    const command = new StartCallAnalyticsStreamTranscriptionCommand({
      LanguageCode: "en-US",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 48000,
      AudioStream: audioStream(),
    });

    const response = await client.send(command);
    if (response.CallAnalyticsTranscriptResultStream) {
      const resultStream = response.CallAnalyticsTranscriptResultStream;
      for await (const event of resultStream) {
        const utteranceEvent = event.UtteranceEvent;
        if (utteranceEvent === undefined) {
          return;
        }
        if (utteranceEvent.ParticipantRole === "AGENT") {
          if (utteranceEvent.Transcript === undefined) {
            return;
          }
          setAgentAnalytics((prev) => {
            const index = prev.length - 1;
            const transcript = utteranceEvent.Transcript ?? "";
            if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
              // segment is complete
              const tmp = update(prev, {
                $push: [
                  {
                    isPartial: utteranceEvent.IsPartial ?? false,
                    transcript,
                    sentiment: utteranceEvent.Sentiment,
                  },
                ],
              });
              return tmp;
            } else {
              // segment is NOT complete(overrides the previous segment's transcript)
              const tmp = update(prev, {
                $splice: [
                  [
                    index,
                    1,
                    {
                      isPartial: utteranceEvent.IsPartial ?? false,
                      transcript,
                      sentiment: utteranceEvent.Sentiment,
                    },
                  ],
                ],
              });
              return tmp;
            }
          });
        } else {
          // console.log("CUSTOMER TRANSCRIPT occurred");
        }
      }
    }
  };
  const startCallAnalyticsStream = async () => {
    const mic = new MicrophoneStream();
    const audioStream = await window.navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    mic.setStream(audioStream);

    await startStream(mic);
  };
  return {
    startCallAnalyticsStream,
    agentAnalytics,
  };
};
