/// One thing on the shelf.
struct Item: Identifiable {
    let name: String
    var id: String { name }
}
