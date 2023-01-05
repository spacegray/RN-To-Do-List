import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Keyboard,
  ScrollView,
} from "react-native";
import Task from "./components/Task";
import { Ionicons } from "@expo/vector-icons";

export default function App() {

  const [task, setTask] = useState();
  const [taskItems, setTaskItems] = useState([]);
  const [completedTask, setCompletedTask] = useState([]);

  const handleAddTask = () => {
    Keyboard.dismiss();
    setTaskItems([...taskItems, task]);
    setTask(null);
  };

  const completeTask = (index) => {
    let itemsCopy = [...taskItems];
    let completedTaskCopy = [itemsCopy[index]];
    itemsCopy.splice(index, 1);
    setTaskItems(itemsCopy);
    setCompletedTask([...completedTask, completedTaskCopy]);
  };

  // clear task from completedTask array
  const clearTask = (index) => {
    let itemsCopy = [...completedTask];
    itemsCopy.splice(index, 1);
    setCompletedTask(itemsCopy);
  };


  return (
    <View style={styles.container}>
      {/* Added this scroll view to enable scrolling when list gets longer than the page */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Today's Tasks */}
        <View style={styles.tasksWrapper}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <View style={styles.itemContainer}>
            <View style={styles.items}>
              {/* This is where the tasks will go! */}
              {taskItems?.map((item, index) => {
                return (
                  <TouchableOpacity
                    key={index}
                    onPress={() => completeTask(index)}
                  >
                    <Task text={item} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.tasksWrapper}>
          <Text style={styles.sectionTitle}>Completed Tasks</Text>
          <View style={styles.items}>
            {/* This is where the tasks will go! */}
            {completedTask?.map((item, index) => {
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => clearTask(index)}
                >
                  <Task text={item} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Write a task */}
      {/* Uses a keyboard avoiding view which ensures the keyboard does not cover the items on screen */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.writeTaskWrapper}
      >
        <TextInput
          style={styles.input}
          placeholder={"Write a task"}
          value={task}
          onChangeText={(text) => setTask(text)}
        />
        <TouchableOpacity onPress={() => handleAddTask()}>
          <View style={styles.addWrapper}>
            <Text style={styles.addText}>
              <Ionicons name="ios-add" size={24} color="black" />

            </Text>
          </View>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#d8e6fd",
  },
  tasksWrapper: {
    paddingTop: 80,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#232528",
    // fontFamily: "Anybody-Regular",
  },
  itemContainer: {
    marginTop: 10,
    // BorderColor: "#F0FFF0",
    // borderWidth: 1,
  },
  items: {
    marginTop: 30,
   
  },
  writeTaskWrapper: {
    position: "absolute",
    bottom: 60,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  input: {
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: "#FFF",
    borderRadius: 60,
    borderColor: "#C0C0C0",
    borderWidth: 1,
    width: 250,
  },
  addWrapper: {
    width: 60,
    height: 60,
    backgroundColor: "#FFF",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#C0C0C0",
    borderWidth: 1,
  },
  addText: { color: "#808080" },
});
