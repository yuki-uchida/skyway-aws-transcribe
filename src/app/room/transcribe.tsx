import {
  AudioStream,
  StartStreamTranscriptionCommand,
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";
import update from "immutability-helper";
import {Buffer} from "buffer";
import MicrophoneStream from "microphone-stream";
import {useState} from "react";
import {pcmEncodeChunk} from "./pcmEncode";

export const useTranscribe = () => {
  const [transcripts, setTranscripts] = useState<
    {
      isPartial: boolean;
      transcript: string;
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
      for await (const chunk of mic as unknown as Buffer[]) {
        const audioEvent: AudioStream.AudioEventMember = {
          AudioEvent: {
            AudioChunk: pcmEncodeChunk(chunk),
          },
        };
        yield audioEvent;
      }
    };
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: "ja-JP",
      MediaEncoding: "pcm",
      MediaSampleRateHertz: 48000,
      AudioStream: audioStream(),
    });
    const response = await client.send(command);
    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (
          event.TranscriptEvent?.Transcript?.Results &&
          event.TranscriptEvent.Transcript?.Results.length > 0
        ) {
          const result = event.TranscriptEvent.Transcript?.Results[0];
          setTranscripts((prev) => {
            const transcript = (
              result.Alternatives?.map(
                (alternative) => alternative.Transcript ?? ""
              ) ?? []
            ).join("");

            const index = prev.length - 1;
            if (prev.length === 0 || !prev[prev.length - 1].isPartial) {
              const tmp = update(prev, {
                $push: [
                  {
                    isPartial: result.IsPartial ?? false,
                    transcript,
                  },
                ],
              });
              return tmp;
            } else {
              const tmp = update(prev, {
                $splice: [
                  [
                    index,
                    1,
                    {
                      isPartial: result.IsPartial ?? false,
                      transcript,
                    },
                  ],
                ],
              });
              return tmp;
            }
          });
        }
      }
    }
  };
  const startTranscriptionStream = async () => {
    const mic = new MicrophoneStream();
    const audioStream = await window.navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    mic.setStream(audioStream);

    await startStream(mic);
  };
  return {
    startTranscriptionStream,
    transcripts,
  };
};
