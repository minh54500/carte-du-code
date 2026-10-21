import Foundation

final class Store: ObservableObject {
    @Published var items: [Item] = []
}
