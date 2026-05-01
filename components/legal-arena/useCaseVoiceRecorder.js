"use client";

import { useEffect, useRef, useState } from "react";
import apiClient from "@/libs/api";

export const useCaseVoiceRecorder = ({ setQuestion, setArgument }) => {
  const [recordingQuestion, setRecordingQuestion] = useState(false);
  const [transcribingQuestion, setTranscribingQuestion] = useState(false);
  const [recordingArgument, setRecordingArgument] = useState(false);
  const [transcribingArgument, setTranscribingArgument] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleVoiceInput = async ({
    recording,
    setRecording,
    setTranscribing,
    setText,
  }) => {
    if (recording) {
      stopRecording();
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      console.error("Voice input is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      streamRef.current = stream;
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const formData = new FormData();

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setRecording(false);

        if (!audioBlob.size) {
          return;
        }

        formData.append("audio", audioBlob, "question.webm");
        setTranscribing(true);

        try {
          const { text } = await apiClient.post("/transcribe", formData);

          if (text) {
            setText((current) =>
              [current.trim(), text.trim()].filter(Boolean).join(" ")
            );
          }
        } catch (error) {
          console.error(error);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error(error);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      setRecording(false);
    }
  };

  const handleQuestionVoiceInput = () =>
    handleVoiceInput({
      recording: recordingQuestion,
      setRecording: setRecordingQuestion,
      setTranscribing: setTranscribingQuestion,
      setText: setQuestion,
    });

  const handleArgumentVoiceInput = () =>
    handleVoiceInput({
      recording: recordingArgument,
      setRecording: setRecordingArgument,
      setTranscribing: setTranscribingArgument,
      setText: setArgument,
    });

  return {
    recordingQuestion,
    transcribingQuestion,
    recordingArgument,
    transcribingArgument,
    handleQuestionVoiceInput,
    handleArgumentVoiceInput,
  };
};
