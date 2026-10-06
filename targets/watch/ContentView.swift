import SwiftUI

struct ContentView: View {
  @ObservedObject var controller = BreathSessionController.shared
  @ObservedObject var state = StateSessionController.shared

  var body: some View {
    Group {
      if state.active {
        StateControlView(state: state)
      } else {
        breathView
      }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.black)
  }

  private var breathView: some View {
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
  }
}

/* State Control op de pols. De knoppen sturen een watch_action naar de
   telefoon (bron van waarheid); die stuurt daarna zelf state_pause /
   state_start / state_stop terug. */
private struct StateControlView: View {
  @ObservedObject var state: StateSessionController

  var body: some View {
    VStack(spacing: 6) {
      Text("STATE CONTROL")
        .font(.system(size: 10))
        .foregroundColor(.gray)

      Text(state.title.uppercased())
        .font(.system(size: 18, weight: .heavy))
        .multilineTextAlignment(.center)
        .foregroundColor(state.color)

      TimelineView(.periodic(from: .now, by: 1)) { context in
        Text(remainingLabel(now: context.date))
          .font(.system(size: 12))
          .foregroundColor(state.paused ? .gray : .white)
      }

      HStack(spacing: 8) {
        Button(state.paused ? "Resume" : "Pause") {
          state.requestPauseOrResume()
        }
        Button("Stop") {
          state.requestStop()
        }
        .tint(.gray)
      }
      .padding(.top, 6)
    }
  }

  private func remainingLabel(now: Date) -> String {
    if state.paused {
      return "Paused · \(minutes(state.pausedRemainingSec)) min left"
    }
    guard let end = state.endDate else { return "" }
    return "\(minutes(end.timeIntervalSince(now))) min left"
  }

  private func minutes(_ seconds: Double) -> Int {
    max(0, Int((seconds / 60).rounded(.up)))
  }
}
