import SwiftUI

/// The app: one window with the shelf.
@main
struct ShelfApp: App {
    let store = Store()
    var body: some Scene { WindowGroup { ContentView(store: store) } }
}
