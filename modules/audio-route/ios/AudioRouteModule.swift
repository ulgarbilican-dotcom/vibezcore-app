import AVFoundation
import ExpoModulesCore

/* VIBEZCORE (operator, 9 okt 2026): het hartslaggeluid klinkt op de speaker
   en in een koptelefoon anders — de app kiest per uitgang de juiste versie. */
public class AudioRouteModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AudioRoute")

    Function("isHeadphones") { () -> Bool in
      let headphoneTypes: Set<AVAudioSession.Port> = [
        .headphones, .bluetoothA2DP, .bluetoothLE, .bluetoothHFP, .usbAudio,
      ]
      return AVAudioSession.sharedInstance().currentRoute.outputs.contains { headphoneTypes.contains($0.portType) }
    }
  }
}
