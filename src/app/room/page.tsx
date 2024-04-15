"use client";
import {
  SkyWayRoom,
  SkyWayContext,
  LocalP2PRoomMember,
  SkyWayStreamFactory,
  P2PRoom,
  RoomPublication,
  LocalDataStream,
} from "@skyway-sdk/room";
import {useSearchParams} from "next/navigation";
import {useEffect, useRef, useState} from "react";
import {useTranscribe} from "./transcribe";
import {useCallAnalytics} from "./callAnalytics";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
  faFaceAngry,
  faFaceMeh,
  faFaceSmile,
} from "@fortawesome/free-solid-svg-icons";
interface SkyWayCredential {
  channelName: string;
  memberName: string;
  iat: number;
  exp: number;
  authToken: string;
}

export default function Room() {
  const roomId = useSearchParams().get("roomId") ?? "";
  const memberName = useSearchParams().get("memberName") ?? "";
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const [token, setToken] = useState<string>("");
  const [room, setRoom] = useState<P2PRoom>();
  const [me, setMe] = useState<LocalP2PRoomMember>();
  const [dataStream, setDataStream] = useState<LocalDataStream>();
  const {startCallAnalyticsStream, agentAnalytics} = useCallAnalytics();
  const {startTranscriptionStream, transcripts} = useTranscribe();
  const [remoteTranscript, setRemoteTranscript] = useState<string[]>([]);

  useEffect(
    () => {
      const getToken = async () => {
        const res = await fetch(
          `http://localhost:3000/api/room?roomId=${roomId}&memberName=${memberName}`
        );
        const credential: SkyWayCredential = await res.json();
        const authToken: string = credential.authToken;
        setToken(authToken);
      };
      getToken();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  useEffect(
    () => {
      if (token === "") {
        return;
      }
      const roomJoinAndPublish = async () => {
        const context = await SkyWayContext.Create(token);
        const room: P2PRoom = await SkyWayRoom.FindOrCreate(context, {
          type: "p2p",
          name: roomId,
        });
        setRoom(room);
        const me: LocalP2PRoomMember = await room.join();
        setMe(me);
        const {audio, video} =
          await SkyWayStreamFactory.createMicrophoneAudioAndCameraStream(); // 2

        if (localVideoRef.current) {
          video.attach(localVideoRef.current); // 3
        }

        const dataStream = await SkyWayStreamFactory.createDataStream();
        setDataStream(dataStream);
        await me.publish(dataStream);
        await me.publish(audio);
        await me.publish(video, {
          codecCapabilities: [
            // { mimeType: "video/av1" },
            {mimeType: "video/h264"},
          ],
        });
        const subscribeAndAttach = async (publication: RoomPublication) => {
          if (publication.publisher.id === me.id) {
            return;
          }
          const {stream} = await me.subscribe(publication.id);
          const remoteMediaArea = document.getElementById("remoteMediaArea");
          switch (stream.contentType) {
            case "video":
              const videoMedia: HTMLVideoElement =
                document.createElement("video");
              videoMedia.playsInline = true;
              videoMedia.autoplay = true;
              stream.attach(videoMedia);
              if (remoteMediaArea != null) {
                remoteMediaArea.appendChild(videoMedia);
              }
              break;
            case "audio":
              const audioMedia: HTMLAudioElement =
                document.createElement("audio");
              audioMedia.controls = true;
              audioMedia.autoplay = true;
              stream.attach(audioMedia);
              if (remoteMediaArea != null) {
                remoteMediaArea.appendChild(audioMedia);
              }
              break;
            case "data":
              stream.onData.add((data) => {
                setRemoteTranscript((prevTranscripts) => [
                  ...prevTranscripts,
                  data as string,
                ]);
              });
              break;
          }
        };
        room.publications.forEach(subscribeAndAttach);
        room.onStreamPublished.add((e) => subscribeAndAttach(e.publication));
      };

      roomJoinAndPublish();
      const leaveRoom = async () => {
        if (me === undefined) {
          return;
        }
        for (const pub of me.publications) {
          await me.unpublish(pub.id);
        }

        await me.leave();
      };
      return () => {
        leaveRoom();
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token]
  );

  useEffect(() => {
    if (dataStream === undefined || transcripts.length === 0) {
      return;
    }
    if (transcripts.slice(-1)[0].isPartial === false) {
      dataStream.write(transcripts.slice(-1)[0].transcript);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcripts]);

  return (
    <div>
      <h1>RoomId: {roomId}</h1>
      <h1>MemberName: {memberName}</h1>
      <div className="videoBox grid grid-cols-2">
        <video
          controls
          className="localVideo"
          playsInline
          ref={localVideoRef}
          muted
          autoPlay
        />
        <div id="remoteMediaArea"></div>
      </div>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 mt-2 rounded"
        onClick={startTranscriptionStream}
      >
        Start Recording
      </button>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 mt-2 rounded"
        onClick={startCallAnalyticsStream}
      >
        Start Call Analytics
      </button>
      <div className="transcriptBox grid grid-cols-2">
        <div className="localTranscript">
          {transcripts.length > 0 && (
            <>
              <div className="col-span-1 bg-gray-100">
                Transcription without sentiment analysis
                <ul>
                  {transcripts.map((t, i) => (
                    <li key={i}>{t.transcript}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <div className="remoteTranscript">
          {remoteTranscript.length > 0 && (
            <>
              <div className="col-span-1 bg-gray-50">
                Transcription without sentiment analysis
                <ul>
                  {remoteTranscript.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {agentAnalytics.length > 0 && (
        <>
          <div className="col-span-1 bg-gray-100">
            Agent Call
            <ul>
              {agentAnalytics.map((t, i) => (
                <>
                  <li key={i}>
                    {
                      <>
                        {t.sentiment === "NEGATIVE" && (
                          <FontAwesomeIcon
                            icon={faFaceAngry}
                            className="h-[20px] pr-1"
                            color="#ff7f50"
                          />
                        )}
                        {t.sentiment === "POSITIVE" && (
                          <FontAwesomeIcon
                            icon={faFaceSmile}
                            className="h-[20px] pr-1"
                            color="#008000"
                          />
                        )}
                        {t.sentiment === "NEUTRAL" && (
                          <FontAwesomeIcon
                            icon={faFaceMeh}
                            className="h-[20px] pr-1"
                            color="#808080"
                          />
                        )}
                      </>
                    }
                    {t.transcript}
                  </li>
                </>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
