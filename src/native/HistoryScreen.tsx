import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useCookingLog } from "@/hooks/useCookingLog";
import { DictationField } from "@/native/DictationField";
import { haptics } from "@/native/haptics";
import { layoutTransition, useStaggeredEntering } from "@/native/motion";
import { PressableScale } from "@/native/motion-views";
import { nativeColors as colors, nativeFonts } from "@/native/theme";
import {
  LongPressMenu,
  MenuButton,
  SwipeActionRow,
} from "@/native/ListInteractionRow";
import type { CookingLogEntry } from "@/types/cooking-log";
import { Button, Card, Empty, Loading, nativeStyles } from "@/native/ui";

export function HistoryScreen() {
  const { entries, isLoading, updateEntry, deleteEntry } = useCookingLog();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const enteringFor = useStaggeredEntering();
  const setRating = (entry: CookingLogEntry, rating: "up" | "down") => {
    haptics.select();
    updateEntry({
      id: entry.id,
      rating: entry.rating === rating ? null : rating,
    });
  };
  if (isLoading)
    return (
      <View style={nativeStyles.screen}>
        <Loading />
      </View>
    );
  const editNote = (entry: CookingLogEntry) => {
    setComment(entry.comment);
    setEditingId(entry.id);
  };
  const confirmDelete = (entry: CookingLogEntry) =>
    Alert.alert("Delete history entry?", entry.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteEntry(entry.id),
      },
    ]);
  return (
    <View style={nativeStyles.screen}>
      <Animated.FlatList
        data={entries}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        itemLayoutAnimation={layoutTransition}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={nativeStyles.scroll}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Empty
            icon="flame-outline"
            title="No cooking history yet"
            body="Chat with your guru, cook something great, and log it here!"
          />
        }
        renderItem={({ item: entry, index }) => (
          <Animated.View
            entering={enteringFor(index)}
            exiting={FadeOut.duration(180)}
            layout={layoutTransition}
          >
            <SwipeActionRow onDelete={() => confirmDelete(entry)}>
              <Card>
                <View style={styles.top}>
                  <LongPressMenu
                    menuActions={[
                      {
                        id: "like",
                        title: entry.rating === "up" ? "Remove Like" : "Liked",
                        image: "hand.thumbsup",
                        state: entry.rating === "up" ? "on" : "off",
                      },
                      {
                        id: "dislike",
                        title:
                          entry.rating === "down"
                            ? "Remove Not for Me"
                            : "Not for Me",
                        image: "hand.thumbsdown",
                        state: entry.rating === "down" ? "on" : "off",
                      },
                      {
                        id: "note",
                        title: entry.comment ? "Edit Note" : "Add Note",
                        image: "square.and.pencil",
                      },
                      {
                        id: "delete",
                        title: "Delete",
                        image: "trash",
                        attributes: { destructive: true },
                      },
                    ]}
                    onMenuAction={(id) => {
                      if (id === "like") setRating(entry, "up");
                      if (id === "dislike") setRating(entry, "down");
                      if (id === "note") editNote(entry);
                      if (id === "delete") confirmDelete(entry);
                    }}
                  >
                    <View style={styles.titleBlock}>
                      <Text accessibilityRole="header" style={styles.title}>
                        {entry.title}
                      </Text>
                      <Text style={styles.date}>
                        {new Date(`${entry.date}T12:00:00`).toLocaleDateString(
                          undefined,
                          { dateStyle: "long" },
                        )}
                      </Text>
                    </View>
                  </LongPressMenu>
                </View>
                <View style={nativeStyles.row}>
                  <Button
                    label="Liked"
                    icon={
                      entry.rating === "up" ? "thumbs-up" : "thumbs-up-outline"
                    }
                    variant={entry.rating === "up" ? "success" : "secondary"}
                    haptic={null}
                    onPress={() => setRating(entry, "up")}
                  />
                  <Button
                    label="Not for me"
                    icon={
                      entry.rating === "down"
                        ? "thumbs-down"
                        : "thumbs-down-outline"
                    }
                    variant={entry.rating === "down" ? "danger" : "secondary"}
                    haptic={null}
                    onPress={() => setRating(entry, "down")}
                  />
                </View>
                {editingId === entry.id ? (
                  <Animated.View
                    entering={FadeIn.duration(200)}
                    style={styles.noteEditor}
                  >
                    <DictationField
                      accessibilityLabel={`Note for ${entry.title}`}
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      autoFocus
                      placeholder="What would you change next time?"
                    />
                    <View style={nativeStyles.row}>
                      <Button
                        label="Save note"
                        haptic="medium"
                        onPress={() => {
                          updateEntry({
                            id: entry.id,
                            comment: comment.trim(),
                          });
                          setEditingId(null);
                        }}
                      />
                      <Button
                        label="Cancel"
                        variant="secondary"
                        haptic={null}
                        onPress={() => setEditingId(null)}
                      />
                    </View>
                  </Animated.View>
                ) : (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={
                      entry.comment
                        ? `Edit note. ${entry.comment}`
                        : "Add a note"
                    }
                    accessibilityHint="Edits this note; long press the card for more actions"
                    haptic="select"
                    scaleTo={0.98}
                    style={styles.noteButton}
                    onPress={() => editNote(entry)}
                  >
                    <Text
                      style={
                        entry.comment ? styles.comment : nativeStyles.muted
                      }
                    >
                      {entry.comment || "Add a note…"}
                    </Text>
                  </PressableScale>
                )}
                <View style={styles.menuRow}>
                  <MenuButton
                    menuActions={[
                      {
                        id: "like",
                        title: entry.rating === "up" ? "Remove Like" : "Liked",
                        image: "hand.thumbsup",
                        state: entry.rating === "up" ? "on" : "off",
                      },
                      {
                        id: "dislike",
                        title:
                          entry.rating === "down"
                            ? "Remove Not for Me"
                            : "Not for Me",
                        image: "hand.thumbsdown",
                        state: entry.rating === "down" ? "on" : "off",
                      },
                      {
                        id: "note",
                        title: entry.comment ? "Edit Note" : "Add Note",
                        image: "square.and.pencil",
                      },
                      {
                        id: "delete",
                        title: "Delete",
                        image: "trash",
                        attributes: { destructive: true },
                      },
                    ]}
                    onMenuAction={(id) => {
                      if (id === "like") setRating(entry, "up");
                      if (id === "dislike") setRating(entry, "down");
                      if (id === "note") editNote(entry);
                      if (id === "delete") confirmDelete(entry);
                    }}
                  />
                </View>
              </Card>
            </SwipeActionRow>
          </Animated.View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titleBlock: { flex: 1 },
  title: {
    color: colors.espresso,
    fontSize: 19,
    fontFamily: nativeFonts.serifBold,
  },
  date: { color: colors.stone500, marginTop: 3, fontFamily: nativeFonts.sans },
  menuRow: { alignItems: "flex-end", marginBottom: -10 },
  noteEditor: { gap: 10 },
  noteButton: { minHeight: 44, justifyContent: "center" },
  comment: {
    color: colors.espresso,
    lineHeight: 21,
    padding: 9,
    borderRadius: 9,
    backgroundColor: colors.creamDeep,
    fontFamily: nativeFonts.sans,
  },
});
