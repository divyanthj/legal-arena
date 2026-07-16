"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/libs/api";

export const useCaseVoiceRecorder = ({
  setQuestion,
  setArgument,
  setSettlementClientInstruction,
  setSettlementMessage,
}) => {
  const [recordingQuestion, setRecordingQuestion] = useState(false);
  const [transcribingQuestion, setTranscribingQuestion] = useState(false);
  const [questionAudioLevel, setQuestionAudioLevel] = useState(0);
  const [recordingArgument, setRecordingArgument] = useState(false);
  const [transcribingArgument, setTranscribingArgument] = useState(false);
  const [argumentAudioLevel, setArgumentAudioLevel] = useState(0);
  const [recordingSettlementClientInstruction, setRecordingSettlementClientInstruction] = useState(false);
  const [transcribingSettlementClientInstruction, setTranscribingSettlementClientInstruction] = useState(false);
  const [settlementClientInstructionAudioLevel, setSettlementClientInstructionAudioLevel] = useState(0);
  const [recordingSettlementMessage, setRecordingSettlementMessage] = useState(false);
  const [transcribingSettlementMessage, setTranscribingSettlementMessage] = useState(false);
  const [settlementMessageAudioLevel, setSettlementMessageAudioLevel] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioFrameRef = useRef(null);

  const stopAudioLevelMonitor = () => {
    if (audioFrameRef.current) {
      cancelAnimationFrame(audioFrameRef.current);
      audioFrameRef.current = null;
    }

    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;

    if (audioContextRef.current?.state !== "closed") {
      audioContextRef.current?.close().catch(() => {});
    }
    audioContextRef.current = null;
  };

  const startAudioLevelMonitor = (stream, setAudioLevel) => {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    try {
      stopAudioLevelMonitor();

      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      audioSourceRef.current = source;

      const samples = new Uint8Array(analyser.fftSize);
      let previousLevel = 0;

      const readLevel = () => {
        analyser.getByteTimeDomainData(samples);

        let total = 0;
        for (const sample of samples) {
          const centered = sample - 128;
          total += centered * centered;
        }

        const rms = Math.sqrt(total / samples.length);
        const rawLevel = Math.min(1, rms / 36);
        const nextLevel = Math.max(rawLevel, previousLevel * 0.82);

        if (Math.abs(nextLevel - previousLevel) > 0.015) {
          previousLevel = nextLevel;
          setAudioLevel(nextLevel);
        }

        audioFrameRef.current = requestAnimationFrame(readLevel);
      };

      readLevel();
    } catch (error) {
      console.error(error);
      stopAudioLevelMonitor();
    }
  };

  useEffect(
    () => () => {
      stopAudioLevelMonitor();
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
    setAudioLevel,
  }) => {
    if (recording) {
      stopRecording();
      return;
    }

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      console.error("Voice input is not supported in this browser.");
      toast.error("Voice recording is not supported in this browser. You can still type your message.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      streamRef.current = stream;
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      setAudioLevel(0);
      startAudioLevelMonitor(stream, setAudioLevel);

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
        stopAudioLevelMonitor();
        setAudioLevel(0);
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
      if (error?.name === "NotAllowedError" || error?.name === "SecurityError") {
        toast.error("Microphone access is blocked. Allow microphone access and try again.");
      } else {
        toast.error("The microphone could not start. You can still type your message.");
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      stopAudioLevelMonitor();
      setAudioLevel(0);
      setRecording(false);
    }
  };

  const handleQuestionVoiceInput = () =>
    handleVoiceInput({
      recording: recordingQuestion,
      setRecording: setRecordingQuestion,
      setTranscribing: setTranscribingQuestion,
      setText: setQuestion,
      setAudioLevel: setQuestionAudioLevel,
    });

  const handleArgumentVoiceInput = () =>
    handleVoiceInput({
      recording: recordingArgument,
      setRecording: setRecordingArgument,
      setTranscribing: setTranscribingArgument,
      setText: setArgument,
      setAudioLevel: setArgumentAudioLevel,
    });

  const handleSettlementClientInstructionVoiceInput = () =>
    handleVoiceInput({
      recording: recordingSettlementClientInstruction,
      setRecording: setRecordingSettlementClientInstruction,
      setTranscribing: setTranscribingSettlementClientInstruction,
      setText: setSettlementClientInstruction,
      setAudioLevel: setSettlementClientInstructionAudioLevel,
    });

  const handleSettlementMessageVoiceInput = () =>
    handleVoiceInput({
      recording: recordingSettlementMessage,
      setRecording: setRecordingSettlementMessage,
      setTranscribing: setTranscribingSettlementMessage,
      setText: setSettlementMessage,
      setAudioLevel: setSettlementMessageAudioLevel,
    });

  return {
    recordingQuestion,
    transcribingQuestion,
    questionAudioLevel,
    recordingArgument,
    transcribingArgument,
    argumentAudioLevel,
    recordingSettlementClientInstruction,
    transcribingSettlementClientInstruction,
    settlementClientInstructionAudioLevel,
    recordingSettlementMessage,
    transcribingSettlementMessage,
    settlementMessageAudioLevel,
    handleQuestionVoiceInput,
    handleArgumentVoiceInput,
    handleSettlementClientInstructionVoiceInput,
    handleSettlementMessageVoiceInput,
  };
};
