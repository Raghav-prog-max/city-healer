/**
 * Spoken commands must be recognised in English and Hindi, and ordinary speech
 * about the same subjects must be left alone so it can be dictated as symptoms.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseVoiceCommand } from "../src/utils/voiceCommands";

const nav = (text: string) => {
  const c = parseVoiceCommand(text);
  return c && c.kind === "navigate" ? c.tab : c?.kind ?? null;
};

describe("voice commands", () => {
  test("navigation in English", () => {
    assert.equal(nav("Open hospitals"), "beds");
    assert.equal(nav("go to the pharmacy"), "pharmacy");
    assert.equal(nav("show my reports"), "records");
    assert.equal(nav("take me to doctors please"), "consultation");
    assert.equal(nav("open symptom checker"), "symptoms");
    assert.equal(nav("open dashboard."), "overview");
  });

  test("navigation in Hindi and romanised Hindi", () => {
    assert.equal(nav("अस्पताल खोलो"), "beds");
    assert.equal(nav("दवा दिखाओ"), "pharmacy");
    assert.equal(nav("डॉक्टर खोलो"), "consultation");
    assert.equal(nav("aspatal kholo"), "beds");
    assert.equal(nav("dawai dikhao"), "pharmacy");
  });

  test("emergency words open the SOS screen", () => {
    for (const t of ["emergency", "SOS", "call an ambulance", "एम्बुलेंस बुलाओ", "open emergency"]) {
      assert.equal(nav(t), "sos", t);
    }
  });

  test("fixed commands", () => {
    assert.equal(nav("help"), "help");
    assert.equal(nav("stop listening"), "stop");
    assert.equal(nav("Clear"), "clear");
    assert.equal(nav("मिटाओ"), "clear");
    assert.equal(nav("run diagnosis"), "submit");
    assert.equal(nav("जांच करो"), "submit");
    assert.equal(nav("log out"), "logout");
  });

  test("ordinary speech is not a command", () => {
    for (const t of [
      "I went to the hospital yesterday and they gave me medicine",
      "my stomach hurts since morning",
      "I have chest pain",
      "the doctor told me to rest",
      "open",
      "मुझे कल से बुखार है",
      "show me something",
      "",
    ]) {
      assert.equal(parseVoiceCommand(t), null, t);
    }
  });
});
