import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from "react-native";

const Task = ({ text, id, completed, deleteTask, editTask }) => {
  const [editable, setEditable] = useState(false);
  const [taskText, setTaskText] = useState(text);

  const handleDelete = () => {
    deleteTask(id);
  };

  // write a function to edit the existing task and add the new value to state
  const handleEdit = () => {
    if (editable) {
      editTask(id, taskText);
    }
    setEditable(!editable);
  };

  const handleTextChange = (text) => {
    setTaskText(text);
  };

  return (
    <View style={styles.task}>
      {editable ? (
        <TextInput
          style={styles.input}
          value={taskText}
          onChangeText={handleTextChange}
          autoFocus={true}
          onBlur={handleEdit}
        />
      ) : (
        <Text style={styles.taskText}>{text}</Text>
      )}
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={handleEdit}>
          <Text style={styles.button}>{editable ? "Save" : "Edit"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.button}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  task: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: "#F3D3BD",
    marginBottom: 20,
    paddingLeft: 20,
    paddingRight: 10,
    shadowColor: "#333",
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
    elevation: 5,
  },
  taskText: {
    fontSize: 18,
    color: "#6B5B95",
    flex: 1,
  },
  input: {
    fontSize: 18,
    color: "#6B5B95",
    flex: 1,
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  button: {
    fontSize: 16,
    color: "#6B5B95",
    marginLeft: 10,
  },
});

export default Task;
