import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCookingLog } from "@/hooks/useCookingLog";
import { colors } from "@/theme";
import { LongPressMenu, SwipeActionRow } from "@/native/ListInteractionRow";
import type { CookingLogEntry } from "@/types/cooking-log";
import { Button, Card, Empty, Field, Loading, nativeStyles } from "@/native/ui";

export function HistoryScreen() {
  const { entries, isLoading, updateEntry, deleteEntry } = useCookingLog();
  const [editingId, setEditingId] = useState<string | null>(null); const [comment, setComment] = useState("");
  if (isLoading) return <View style={nativeStyles.screen}><Loading /></View>;
  const editNote = (entry: CookingLogEntry) => { setComment(entry.comment); setEditingId(entry.id); };
  const confirmDelete = (entry: CookingLogEntry) => Alert.alert("Delete history entry?", entry.title, [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => deleteEntry(entry.id) },
  ]);
  return <View style={nativeStyles.screen}><ScrollView contentContainerStyle={nativeStyles.scroll}>
    {entries.length === 0 && <Empty title="No cooking history yet" body="Chat with your guru, cook something great, and log it here!" />}
    {entries.map((entry) => <SwipeActionRow key={entry.id} onDelete={() => confirmDelete(entry)}><Card><View style={styles.top}><LongPressMenu
      menuActions={[
        { id: "like", title: entry.rating === "up" ? "Remove Like" : "Liked", image: "hand.thumbsup", state: entry.rating === "up" ? "on" : "off" },
        { id: "dislike", title: entry.rating === "down" ? "Remove Not for Me" : "Not for Me", image: "hand.thumbsdown", state: entry.rating === "down" ? "on" : "off" },
        { id: "note", title: entry.comment ? "Edit Note" : "Add Note", image: "square.and.pencil" },
        { id: "delete", title: "Delete", image: "trash", attributes: { destructive: true } },
      ]}
      onMenuAction={(id) => {
        if (id === "like") updateEntry({ id: entry.id, rating: entry.rating === "up" ? null : "up" });
        if (id === "dislike") updateEntry({ id: entry.id, rating: entry.rating === "down" ? null : "down" });
        if (id === "note") editNote(entry);
        if (id === "delete") confirmDelete(entry);
      }}
    ><View><Text style={styles.title}>{entry.title}</Text><Text style={styles.date}>{new Date(`${entry.date}T12:00:00`).toLocaleDateString(undefined, { dateStyle: "long" })}</Text></View></LongPressMenu><Pressable accessibilityLabel="Delete history entry" onPress={() => confirmDelete(entry)}><Ionicons name="trash-outline" size={21} color={colors.danger} /></Pressable></View>
      <View style={nativeStyles.row}><Button label={entry.rating === "up" ? "Liked ✓" : "Liked"} variant="secondary" onPress={() => updateEntry({ id: entry.id, rating: entry.rating === "up" ? null : "up" })} /><Button label={entry.rating === "down" ? "Not for me ✓" : "Not for me"} variant="secondary" onPress={() => updateEntry({ id: entry.id, rating: entry.rating === "down" ? null : "down" })} /></View>
      {editingId === entry.id ? <><Field value={comment} onChangeText={setComment} multiline autoFocus placeholder="What would you change next time?" /><View style={nativeStyles.row}><Button label="Save note" onPress={() => { updateEntry({ id: entry.id, comment: comment.trim() }); setEditingId(null); }} /><Button label="Cancel" variant="secondary" onPress={() => setEditingId(null)} /></View></> : <Pressable accessibilityHint="Edits this note; long press the card for more actions" onPress={() => editNote(entry)}><Text style={entry.comment ? styles.comment : nativeStyles.muted}>{entry.comment || "Add a note…"}</Text></Pressable>}
    </Card></SwipeActionRow>)}
  </ScrollView></View>;
}
const styles = StyleSheet.create({ top: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, title: { color: colors.espresso, fontSize: 19, fontWeight: "700" }, date: { color: colors.stone500, marginTop: 3 }, comment: { color: colors.espresso, lineHeight: 21, padding: 9, borderRadius: 9, backgroundColor: colors.creamDeep } });
