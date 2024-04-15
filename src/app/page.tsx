"use client";
import React, {useState} from "react";
import Link from "next/link";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [memberName, setMemberName] = useState("");
  return (
    <div className="mt-8">
      <form className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="border-2 border-gray-300 p-2"
        />
        <input
          type="text"
          placeholder="Member Name"
          value={memberName}
          onChange={(e) => setMemberName(e.target.value)}
          className="border-2 border-gray-300 p-2"
        />
        <Link
          href={{
            pathname: `/room`,
            query: {roomId: `${roomId}`, memberName: `${memberName}`},
          }}
        >
          <button className="bg-blue-500 text-white p-2">Enter Room</button>
        </Link>
      </form>
    </div>
  );
}
