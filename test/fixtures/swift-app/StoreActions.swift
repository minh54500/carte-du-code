import AppKit
import SwiftUI

/// The actions on the shelf: keep a file, empty the shelf.
extension Store {
    func keep(_ name: String) { items.append(Item(name: name)) }
    func empty() { items.removeAll() }
}
