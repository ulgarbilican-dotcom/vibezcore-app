import SwiftUI

struct ContentView: View {
  @ObservedObject var controller = BreathSessionController.shared

  var body: some View {
    VStack(spacing: 6) {
      Text(controller.modeName.isEmpty ? "VIBEZCORE" : controller.modeName.uppercased())
        .font(.system(size: 10))
        .foregroundColor(.gray)

      Text(controller.phaseLabel)
        .font(.system(size: 18, weight: .bold))
        .multilineTextAlignment(.center)
        .foregroundColor(.white)

      if controller.running {
        Text("Round \(controller.round) / \(controller.totalRounds)")
          .font(.system(size: 12))
          .foregroundColor(.gray)

        Button("Stop") {
          controller.stop()
        }
        .padding(.top, 8)
      }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
  }
}
