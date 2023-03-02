import React from "react";
import { TouchableOpacity, Text } from "react-native";

const RandomTaskButton = ({ onRandomTaskSelected }) => {
  const tasks = [
    "Do the dishes",
    "Take out the trash",
    "Walk the dog",
    "Water the plants",
    "Call mom",
    "Buy groceries",
    "Clean the kitchen",
    "Do laundry",
    "Wash the car",
    "Mow the lawn",
    "Plan a vacation",
    "Go to the gym",
    "Go to the movies",
    "Go to the park",
    "Go to the beach",
    "Go to the museum",
    "Work on a side project",
    "Monthly budget",
    "Pay bills",
    "Read a book",
    "Check the mail",
    "Organize Storage",
    "Listen to a podcast",
    "Do yoga",
    "Go for a run",
    "Go for a walk",
    "Learn a new language",
    "Learn a new skill",
    "Learn a new instrument",
    "Learn a new dance",
    "Learn a new recipe",
    "Learn a new sport",
  ];

  const handlePress = () => {
    const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
    onRandomTaskSelected(randomTask);
  };

  return (
    <TouchableOpacity style={{ marginLeft: 10 }} onPress={handlePress}>
      <Text style={{ fontSize: 40, color: "blue", paddingRight: 5 }}>🎲</Text>
    </TouchableOpacity>
  );
};

export default RandomTaskButton;
