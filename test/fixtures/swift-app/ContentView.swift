import SwiftUI

/// The shelf window. Theme is only named in this comment and in a text.
struct ContentView: View {
    let store: Store
    var body: some View { Text("Theme of the day").onTapGesture { store.keep("note") } } // Theme
}
